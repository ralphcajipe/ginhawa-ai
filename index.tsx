/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from '@google/genai';
import { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

const DEFAULT_PROMPT =
  'Highly detailed concept art of a redesigned urban street in the Philippines into a clean, walkable, pedestrian-first cityscape. Features include wide, tiled sidewalks with integrated drainage, shaded by native trees and benches, under elevated concrete LRT viaducts. The midground shows inclusive pedestrian activity—strolling, sitting, socializing—without vehicular obstruction. Structures follow proper urban setbacks, with unified modern facades of wood, stone, and vertical gardens, supporting small glass-front retail shops. Streetscape includes permeable paving, rain-resilient landscaping, and passive cooling through vegetation. Golden-hour sunlight and soft shadows enhance spatial comfort. Inspired by Japanese urban design, adapted to Metro Manila’s tropical, high-density context. Ultra-realistic, isometric perspective, cinematic lighting.';

const NEGATIVE_PROMPT =
  'Do not include: Trash, chaotic traffic, vandalism, dark lighting, broken roads, wires, visual clutter, distorted faces, low-res textures.';

function App() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Effect to handle Escape key for closing the modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setError('No file selected. Please choose an image file.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('The selected file is not an image. Please upload a valid image file (JPEG, PNG, etc.).');
      setUploadedImage(null);
      setGeneratedImage(null);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
      setGeneratedImage(null); // Clear previous generation
      setError(null); // Clear previous errors
    };
    reader.onerror = () => {
      setError('Failed to read the file. Please try again with a different image.');
      setUploadedImage(null);
      setGeneratedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = useCallback(async () => {
    if (!uploadedImage) {
      setError('Please upload an image first.');
      return;
    }

    // Check for API key
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      setError('API key is missing or invalid. Please set a valid API key in your environment.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey });

      // Step 1: Analyze the uploaded image to get a detailed description.
      setLoadingMessage('Analyzing image...');
      const base64Data = uploadedImage.split(',')[1];
      const mimeType = uploadedImage.match(/data:(.*);base64,/)?.[1];

      if (!base64Data || !mimeType) {
        setError('Invalid image format. Please upload a valid image file.');
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }

      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      };

      const analysisPrompt =
        'Describe this street scene image. Focus on the layout, architectural style of the buildings, number of lanes, sidewalk presence, types of trees or vegetation, and atmosphere.';

      let analysisResponse;
      try {
        analysisResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [imagePart, { text: analysisPrompt }] },
        });
      } catch (err: any) {
        if (err?.message?.toLowerCase().includes('api key')) {
          setError('API key is invalid or unauthorized. Please check your API key and try again.');
        } else {
          setError('Failed to analyze the image. Please try again later.');
        }
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }

      const imageDescription = analysisResponse.text;

      // Step 2: Generate a new image using the description and the user's prompt.
      setLoadingMessage('Generating transformation...');
      const finalPrompt = `Based on this description of a street: "${imageDescription}". Now, create a new concept art image that strictly applies the following transformation: "${DEFAULT_PROMPT}". ${NEGATIVE_PROMPT}`;

      let imageResponse;
      try {
        imageResponse = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: finalPrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '16:9',
          },
        });
      } catch (err: any) {
        if (err?.message?.toLowerCase().includes('api key')) {
          setError('API key is invalid or unauthorized. Please check your API key and try again.');
        } else {
          setError('Failed to generate the image. Please try again later.');
        }
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }

      const base64ImageBytes = imageResponse?.generatedImages?.[0]?.image?.imageBytes;
      if (typeof base64ImageBytes !== 'string' || !base64ImageBytes) {
        setError('No image was generated. Please try again with a different photo.');
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }
      const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
      setGeneratedImage(imageUrl);
    } catch (e: any) {
      console.error(e);
      if (e?.message?.toLowerCase().includes('api key')) {
        setError('API key is invalid or unauthorized. Please check your API key and try again.');
      } else {
        setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [uploadedImage]);

  return (
    <div className="app-container">
      <header>
        <h1>Ginhawa AI</h1>
        <p>
          Upload a street view and see it redesigned for people.
        </p>
      </header>

      {error && (
        <div className="error-message" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      <main className="main-content">
        <aside className="controls-panel">
          <input
            id="file-upload"
            type="file"
            onChange={handleImageUpload}
            accept="image/*"
            hidden
          />
          <div className="button-group">
            <label
              htmlFor="file-upload"
              className="icon-btn"
              title="Upload Image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="sr-only">Upload Image</span>
            </label>
            <button
              className="btn"
              onClick={handleGenerate}
              disabled={!uploadedImage || isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? loadingMessage : 'See Potential'}
              {isLoading && (
                <div
                  className="loader"
                  style={{ width: '20px', height: '20px', borderTopColor: 'white' }}
                ></div>
              )}
            </button>
          </div>
        </aside>

        <section className="image-display-panel" aria-live="polite">
          <div className="image-container">
            <h2>Real</h2>
            {uploadedImage ? (
              <img
                src={uploadedImage}
                alt="User uploaded street view"
                onClick={() => setPreviewImage(uploadedImage)}
              />
            ) : (
              <div className="image-placeholder">
                Upload an image to begin
              </div>
            )}
          </div>
          <div className="image-container">
            <h2>Potential</h2>
            {isLoading && (
              <div className="loading-container">
                <div
                  className="loader"
                  aria-label="Loading generated image"
                ></div>
                <p>{loadingMessage}</p>
              </div>
            )}
            {generatedImage && (
              <img
                src={generatedImage}
                alt="AI generated transformed street view"
                onClick={() => setPreviewImage(generatedImage)}
              />
            )}
            {!isLoading && !generatedImage && (
              <div className="image-placeholder">
                Your generated image will appear here
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="image-preview-overlay"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            className="close-preview-btn"
            aria-label="Close preview"
            onClick={() => setPreviewImage(null)}
          >
            &times;
          </button>
          <img
            src={previewImage}
            alt="Enlarged view"
            className="preview-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
