import litellm
import logging
import os
from typing import Optional

# Define custom error classes for compatibility
class AuthenticationError(Exception):
    """Authentication error for LLM API"""
    pass

class RateLimitError(Exception):
    """Rate limit error for LLM API"""
    pass

logger = logging.getLogger(__name__)

class LLMClient:
    """Client for interacting with various LLM APIs via liteLLM"""

    def __init__(self, api_key: str, model: Optional[str] = None):
        """
        Initialize LLM client with API key and model

        Args:
            api_key (str): API key for the LLM provider (typically OpenAI)
            model (str, optional): Model to use (e.g., 'gpt-4', 'grok-beta', 'claude-3-opus')
        """
        # Set OpenAI API key for liteLLM (most common provider)
        os.environ["OPENAI_API_KEY"] = api_key

        # Set the model to use (configurable via environment variable)
        raw_model = model or os.getenv("LLM_MODEL", "gpt-4")

        # Normalize model name for liteLLM compatibility
        self.model = self._normalize_model_name(raw_model)

        logger.info(f"Initialized LLM client with model: {self.model} (from: {raw_model})")

    def _normalize_model_name(self, model: str) -> str:
        """
        Normalize model name for liteLLM compatibility

        Args:
            model (str): Raw model name from configuration

        Returns:
            str: Normalized model name that liteLLM can understand
        """
        # Handle special OpenAI model names that might not be recognized
        openai_model_mappings = {
            "gpt-4-1-2025-04-14": "gpt-4.1",
            "gpt-4.1-2025-04-14": "gpt-4.1",
            "gpt-4-turbo-2024-04-09": "gpt-4-turbo",
            "gpt-4-turbo-preview": "gpt-4-turbo",
        }

        # Check if it's a special OpenAI model that needs mapping
        if model in openai_model_mappings:
            normalized = openai_model_mappings[model]
            logger.info(f"Mapped model '{model}' to '{normalized}' for liteLLM compatibility")
            return normalized

        # If model already has provider prefix, return as-is
        if "/" in model:
            return model

        # For standard OpenAI models, return as-is
        standard_openai_models = [
            "gpt-4", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
            "gpt-4-turbo", "gpt-4o", "gpt-4o-mini",
            "gpt-3.5-turbo", "gpt-3.5-turbo-16k",
            "o3", "o3-mini", "o4-mini", "o1-mini", "o1-preview"
        ]

        if model in standard_openai_models:
            return model

        # For unknown models, assume OpenAI and log warning
        logger.warning(f"Unknown model '{model}', assuming OpenAI provider")
        return model

    def translate_to_english(self, prompt: str) -> str:
        """
        Translate the prompt to English using the configured LLM

        Args:
            prompt (str): Original prompt to translate

        Returns:
            str: English translation of the prompt

        Raises:
            ValueError: If API key is missing or invalid
            RateLimitError: If LLM rate limit is exceeded
            Exception: For other errors
        """
        try:
            system_message = """You are a professional translator.
            Your task is to translate the given text to English.
            Focus on:
            - Accurate translation while maintaining the original meaning
            - Natural English phrasing
            - Preserving any technical or specific terms
            Respond only with the English translation, no explanations."""

            response = litellm.completion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": f"Translate this text to English: {prompt}"}
                ],
                temperature=0.3,
                max_tokens=200
            )

            translated_prompt = response.choices[0].message.content.strip()

            logger.info(f"Translated prompt using {self.model}: {translated_prompt}")
            return translated_prompt

        except Exception as e:
            error_message = str(e).lower()

            # Check for authentication errors based on error message
            if "authentication" in error_message or "api key" in error_message or "invalid" in error_message or "incorrect" in error_message:
                logger.error(f"LLM API authentication error: {str(e)}", exc_info=True)
                raise ValueError("LLM API key is missing or invalid. Please check your configuration.") from e

            # Check for rate limit errors based on error message
            elif "rate limit" in error_message or "too many requests" in error_message:
                logger.error(f"LLM API rate limit exceeded: {str(e)}", exc_info=True)
                raise RateLimitError(f"LLM API rate limit exceeded: {str(e)}") from e

            # Other errors
            else:
                logger.error(f"Error translating prompt: {str(e)}", exc_info=True)
                raise

    def improve_prompt(self, prompt: str) -> str:
        """
        Improve the image generation prompt using the configured LLM

        Args:
            prompt (str): Original prompt to improve

        Returns:
            str: Improved prompt

        Raises:
            ValueError: If API key is missing or invalid
            RateLimitError: If LLM rate limit is exceeded
            Exception: For other errors
        """
        try:
            system_message = """You are an expert at writing prompts for AI image generation.
            Your task is to enhance the given prompt to create more detailed and visually appealing images.
            Focus on:
            - Adding more descriptive details
            - Specifying art style and medium
            - Including lighting and atmosphere details
            - Maintaining the original intent
            Respond only with the enhanced prompt, no explanations."""

            response = litellm.completion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": f"Enhance this image prompt: {prompt}"}
                ],
                temperature=0.7,
                max_tokens=200
            )

            improved_prompt = response.choices[0].message.content.strip()

            logger.info(f"Improved prompt using {self.model}: {improved_prompt}")
            return improved_prompt

        except Exception as e:
            error_message = str(e).lower()

            # Check for authentication errors based on error message
            if "authentication" in error_message or "api key" in error_message or "invalid" in error_message or "incorrect" in error_message:
                logger.error(f"LLM API authentication error: {str(e)}", exc_info=True)
                raise ValueError("LLM API key is missing or invalid. Please check your configuration.") from e

            # Check for rate limit errors based on error message
            elif "rate limit" in error_message or "too many requests" in error_message:
                logger.error(f"LLM API rate limit exceeded: {str(e)}", exc_info=True)
                raise RateLimitError(f"LLM API rate limit exceeded: {str(e)}") from e

            # Other errors
            else:
                logger.error(f"Error improving prompt: {str(e)}", exc_info=True)
                raise
