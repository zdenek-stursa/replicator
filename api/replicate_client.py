import replicate
import logging
import requests
from typing import Dict, Optional, Any
from replicate.exceptions import ModelError, ReplicateError
import tempfile
import os

logger = logging.getLogger(__name__)

class ReplicateClient:
    """Client for interacting with Replicate API"""

    # SUPPORTED_MODELS dictionary is removed as models are now dynamic

    def __init__(self, api_token: str):
        """Initialize Replicate client"""
        # The replicate library automatically uses REPLICATE_API_TOKEN env var
        if not os.getenv('REPLICATE_API_TOKEN'):
            logger.warning("REPLICATE_API_TOKEN environment variable not set.")
            # Depending on strictness, could raise an error here

    def generate_image(self, prompt: str, model_id: str, input_params: Dict[str, Any]) -> Dict:
        """
        Generate image using a specified model and dynamic parameters.

        Args:
            prompt (str): Image generation prompt.
            model_id (str): The full identifier of the Replicate model (e.g., "owner/model-name").
            input_params (Dict[str, Any]): Dictionary of parameters specific to the model.

        Returns:
            Dict: Response containing the path to the generated image file and metadata.
        """
        # Model validation is now handled in app.py before calling this client
        try:
            # Ensure prompt is included in input parameters
            input_params['prompt'] = prompt

            # Generate seed if not provided, some models might require it or handle it differently
            if 'seed' not in input_params:
                input_params['seed'] = self._generate_seed()

            # Log API parameters
            logger.info(f"Calling Replicate API for model '{model_id}' with input: {input_params}")

            # Run the model
            # Run the model using the full model ID and the provided input parameters
            output = replicate.run(
                model_id,
                input=input_params
            )

            # Log the output for debugging
            # Output from replicate.run for image models is typically a URL or list of URLs
            if not output:
                logger.error(f"Replicate API returned empty output for model {model_id}.")
                raise ValueError("Replicate API returned no output.")

            # Assuming the output is a list of URLs, take the first one
            # Adjust if the model returns a single URL or different structure
            image_url = output[0] if isinstance(output, list) else output
            logger.info(f"Received image URL: {image_url}")

            # Download the image from the URL
            response = requests.get(image_url, stream=True)
            response.raise_for_status() # Raise an exception for bad status codes

            # Create temporary file
            # Create temporary file to store the downloaded image
            # Using 'wb' mode for binary writing
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webp', mode='wb') as temp_file:
                logger.info(f"Downloading image to temporary file: {temp_file.name}")
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)
                temp_file.flush() # Ensure all data is written

                # Return the path to the temporary file
                return {
                    'status': 'success',
                    'image_path': temp_file.name, # Return the path, not URL
                    'metadata': {
                        'model_id': model_id,
                        'prompt': prompt, # Original prompt before translation
                        'input_parameters': input_params # Store all used parameters
                    }
                }

        except ModelError as e:
            logger.error(f"Replicate ModelError for model {model_id}: {str(e)}", exc_info=True)
            # Log prediction details if available
            if hasattr(e, 'prediction') and e.prediction:
                logger.error(f"Prediction ID: {e.prediction.id}, Status: {e.prediction.status}, Logs: {e.prediction.logs}")
            raise # Re-raise the specific error
        except ReplicateError as e:
            logger.error(f"Replicate API error for model {model_id}: {str(e)}", exc_info=True)
            raise # Re-raise the specific error
        except requests.exceptions.RequestException as e:
            logger.error(f"Error downloading image from Replicate URL {image_url}: {str(e)}", exc_info=True)
            raise # Re-raise the specific error
        except Exception as e:
            logger.error(f"Unexpected error generating image with model {model_id}: {str(e)}", exc_info=True)
            raise # Re-raise any other unexpected errors

    def _generate_seed(self) -> int:
        """Generate a random seed for image generation"""
        return int.from_bytes(os.urandom(4), byteorder='big') % 1000000000

    # _get_dimensions method is removed as dimensions are now part of input_params

    def get_model_details(self, model_id: str) -> Optional[Dict]:
        """
        Fetch model details (specifically input schema) from Replicate API.

        Args:
            model_id (str): The full identifier of the Replicate model (e.g., "owner/model-name").

        Returns:
            Optional[Dict]: The OpenAPI schema for the model's input parameters, or None if fetching fails.
        """
        try:
            logger.info(f"Fetching model details for: {model_id}")
            # Get the model object
            model = replicate.models.get(model_id)
            # Get the latest version of the model
            version = model.latest_version
            if not version:
                logger.error(f"No version found for model: {model_id}")
                return None

            # Extract the input schema
            schema = version.openapi_schema

            if not schema:
                logger.error(f"Could not retrieve schema for model version: {model_id}/{version.id}")
                return None

            logger.info(f"Successfully retrieved schema for model: {model_id}")
            return schema # Return the whole transformed schema for flexibility

        except ReplicateError as e:
            logger.error(f"Replicate API error fetching details for model {model_id}: {str(e)}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching details for model {model_id}: {str(e)}", exc_info=True)
            return None