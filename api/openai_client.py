from openai import OpenAI
import logging
from typing import Optional

# Define custom error classes for compatibility
class AuthenticationError(Exception):
    """Authentication error for OpenAI API"""
    pass

class RateLimitError(Exception):
    """Rate limit error for OpenAI API"""
    pass

logger = logging.getLogger(__name__)

class OpenAIClient:
    """Client for interacting with OpenAI API"""

    def __init__(self, api_key: str):
        """Initialize OpenAI client with API key"""
        self.client = OpenAI(api_key=api_key)

    def translate_to_english(self, prompt: str) -> str:
        """
        Translate the prompt to English using GPT-4

        Args:
            prompt (str): Original prompt to translate

        Returns:
            str: English translation of the prompt

        Raises:
            ValueError: If API key is missing or invalid
            RateLimitError: If OpenAI rate limit is exceeded
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

            completion = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": f"Translate this text to English: {prompt}"}
                ],
                temperature=0.3,
                max_tokens=200
            )

            translated_prompt = completion.choices[0].message.content.strip()

            logger.info(f"Translated prompt: {translated_prompt}")
            return translated_prompt

        except Exception as e:
            error_message = str(e).lower()

            # Check for authentication errors based on error message
            if "authentication" in error_message or "api key" in error_message or "invalid" in error_message or "incorrect" in error_message:
                logger.error(f"OpenAI API authentication error: {str(e)}", exc_info=True)
                raise ValueError("OpenAI API key is missing or invalid. Please check your configuration.") from e

            # Check for rate limit errors based on error message
            elif "rate limit" in error_message or "too many requests" in error_message:
                logger.error(f"OpenAI API rate limit exceeded: {str(e)}", exc_info=True)
                raise RateLimitError(f"OpenAI API rate limit exceeded: {str(e)}") from e

            # Other errors
            else:
                logger.error(f"Error translating prompt: {str(e)}", exc_info=True)
                raise

    def improve_prompt(self, prompt: str) -> str:
        """
        Improve the image generation prompt using GPT-4

        Args:
            prompt (str): Original prompt to improve

        Returns:
            str: Improved prompt

        Raises:
            ValueError: If API key is missing or invalid
            RateLimitError: If OpenAI rate limit is exceeded
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

            completion = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": f"Enhance this image prompt: {prompt}"}
                ],
                temperature=0.7,
                max_tokens=200
            )

            improved_prompt = completion.choices[0].message.content.strip()

            logger.info(f"Improved prompt: {improved_prompt}")
            return improved_prompt

        except Exception as e:
            error_message = str(e).lower()

            # Check for authentication errors based on error message
            if "authentication" in error_message or "api key" in error_message or "invalid" in error_message or "incorrect" in error_message:
                logger.error(f"OpenAI API authentication error: {str(e)}", exc_info=True)
                raise ValueError("OpenAI API key is missing or invalid. Please check your configuration.") from e

            # Check for rate limit errors based on error message
            elif "rate limit" in error_message or "too many requests" in error_message:
                logger.error(f"OpenAI API rate limit exceeded: {str(e)}", exc_info=True)
                raise RateLimitError(f"OpenAI API rate limit exceeded: {str(e)}") from e

            # Other errors
            else:
                logger.error(f"Error improving prompt: {str(e)}", exc_info=True)
                raise