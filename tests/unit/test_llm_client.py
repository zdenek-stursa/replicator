import pytest
import os
from unittest.mock import patch, MagicMock
from api.llm_client import LLMClient, AuthenticationError, RateLimitError


@pytest.fixture
def llm_client():
    """Create LLM client for testing"""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "test_key", "LLM_MODEL": "gpt-4"}):
        return LLMClient("test_api_key", "gpt-4")


class TestLLMClient:
    """Test cases for LLMClient"""

    def test_init_with_default_model(self):
        """Test initialization with default model"""
        with patch.dict(os.environ, {"LLM_MODEL": "gpt-3.5-turbo"}):
            client = LLMClient("test_key")
            assert client.model == "gpt-3.5-turbo"

    def test_init_with_custom_model(self):
        """Test initialization with custom model"""
        client = LLMClient("test_key", "claude-3-opus")
        assert client.model == "claude-3-opus"

    @patch('api.llm_client.litellm.completion')
    def test_translate_to_english_success(self, mock_completion, llm_client):
        """Test successful translation"""
        # Mock response
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "Hello world"
        mock_completion.return_value = mock_response

        result = llm_client.translate_to_english("Ahoj světe")

        assert result == "Hello world"
        mock_completion.assert_called_once()
        call_args = mock_completion.call_args
        assert call_args[1]['model'] == "gpt-4"
        assert len(call_args[1]['messages']) == 2
        assert "translate" in call_args[1]['messages'][0]['content'].lower()

    @patch('api.llm_client.litellm.completion')
    def test_improve_prompt_success(self, mock_completion, llm_client):
        """Test successful prompt improvement"""
        # Mock response
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "A beautiful cat sitting on a red roof, detailed digital art"
        mock_completion.return_value = mock_response

        result = llm_client.improve_prompt("cat on roof")

        assert result == "A beautiful cat sitting on a red roof, detailed digital art"
        mock_completion.assert_called_once()
        call_args = mock_completion.call_args
        assert call_args[1]['model'] == "gpt-4"
        assert call_args[1]['temperature'] == 0.7

    @patch('api.llm_client.litellm.completion')
    def test_translate_authentication_error(self, mock_completion, llm_client):
        """Test authentication error handling in translation"""
        mock_completion.side_effect = Exception("authentication failed")

        with pytest.raises(ValueError, match="LLM API key is missing or invalid"):
            llm_client.translate_to_english("test prompt")

    @patch('api.llm_client.litellm.completion')
    def test_improve_rate_limit_error(self, mock_completion, llm_client):
        """Test rate limit error handling in prompt improvement"""
        mock_completion.side_effect = Exception("rate limit exceeded")

        with pytest.raises(RateLimitError, match="LLM API rate limit exceeded"):
            llm_client.improve_prompt("test prompt")

    @patch('api.llm_client.litellm.completion')
    def test_generic_error_handling(self, mock_completion, llm_client):
        """Test generic error handling"""
        mock_completion.side_effect = Exception("Some other error")

        with pytest.raises(Exception, match="Some other error"):
            llm_client.translate_to_english("test prompt")

    def test_different_models(self):
        """Test that different models can be configured"""
        models_to_test = [
            ("gpt-4", "gpt-4"),
            ("gpt-4.1", "gpt-4.1"),
            ("gpt-4.1-mini", "gpt-4.1-mini"),
            ("gpt-4.1-nano", "gpt-4.1-nano"),
            ("gpt-3.5-turbo", "gpt-3.5-turbo"),
            ("o3", "o3"),
            ("o3-mini", "o3-mini"),
            ("claude-3-opus-20240229", "claude-3-opus-20240229"),
            ("xai/grok-beta", "xai/grok-beta"),
            ("groq/llama3-8b-8192", "groq/llama3-8b-8192")
        ]

        for input_model, expected_model in models_to_test:
            client = LLMClient("test_key", input_model)
            assert client.model == expected_model

    def test_model_normalization(self):
        """Test model name normalization for liteLLM compatibility"""
        test_cases = [
            ("gpt-4-1-2025-04-14", "gpt-4.1"),
            ("gpt-4.1-2025-04-14", "gpt-4.1"),
            ("gpt-4-turbo-2024-04-09", "gpt-4-turbo"),
            ("gpt-4", "gpt-4"),
            ("gpt-4.1", "gpt-4.1"),
            ("claude-3-opus-20240229", "claude-3-opus-20240229"),
            ("xai/grok-beta", "xai/grok-beta"),
        ]

        for input_model, expected_model in test_cases:
            client = LLMClient("test_key", input_model)
            assert client.model == expected_model, f"Expected {expected_model}, got {client.model} for input {input_model}"
