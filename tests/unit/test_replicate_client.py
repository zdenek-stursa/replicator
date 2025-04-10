import pytest
from unittest.mock import patch, MagicMock
from api.replicate_client import ReplicateClient
import replicate # Import replicate for mocking
from replicate.exceptions import ReplicateError # Import specific exception

# Expected structure of the response from Replicate API for model details
# Simplified structure for testing, focused on the schema
MOCK_API_RESPONSE = MagicMock()
MOCK_API_RESPONSE.latest_version.get_transformed_schema.return_value = {
    "openapi_schema": {
        "components": {
            "schemas": {
                "Input": {
                    "type": "object",
                    "properties": {
                        "prompt": {"type": "string", "description": "Input prompt"},
                        "negative_prompt": {"type": "string", "description": "Negative prompt"},
                        "width": {"type": "integer", "description": "Width"},
                        "height": {"type": "integer", "description": "Height"},
                    },
                    "required": ["prompt"]
                }
            }
        }
    },
    # Add other fields that might be in the transformed schema
    "title": "SDXL",
    "description": "A text-to-image model by Stability AI"
}


@pytest.fixture
def replicate_client_instance():
    """Fixture to create a ReplicateClient instance with a dummy token."""
    # Mock os.getenv just in case __init__ calls it (although it currently doesn't)
    with patch('os.getenv', return_value='dummy_api_key'):
        # Pass a dummy token because __init__ requires it
        client = ReplicateClient(api_token="dummy_test_token")
        yield client

# No need to patch replicate.Client in __init__ because it's not called there

@patch('api.replicate_client.replicate.models') # Mock the models module in the context of replicate_client.py
def test_get_model_details_success(mock_replicate_models, replicate_client_instance):
    """
    Tests successful retrieval of model details.
    Expected that the method calls replicate.models.get and returns the processed schema.
    """
    model_owner = "stability-ai"
    model_name = "sdxl"
    model_id = f"{model_owner}/{model_name}"

    # Reset mock for this test (due to side_effect in another test)
    mock_replicate_models.get.side_effect = None
    # Set the return value for the mocked call to replicate.models.get
    mock_model_success = MagicMock()
    mock_model_success.latest_version.get_transformed_schema.return_value = MOCK_API_RESPONSE.latest_version.get_transformed_schema.return_value
    mock_replicate_models.get.return_value = mock_model_success
    # Reset call for get_transformed_schema if it was called in a previous test
    mock_model_success.latest_version.get_transformed_schema.reset_mock()


    # Call the method under test
    details_schema = replicate_client_instance.get_model_details(model_id)

    # Verify that the mocked method replicate.models.get was called with the correct argument
    mock_replicate_models.get.assert_called_once_with(model_id)

    # Verify that the get_transformed_schema method was called on the returned object
    mock_model_success.latest_version.get_transformed_schema.assert_called_once()

    # Verify the returned schema (it should be what get_transformed_schema returned)
    assert details_schema is not None
    assert details_schema == MOCK_API_RESPONSE.latest_version.get_transformed_schema.return_value
    assert "openapi_schema" in details_schema # Just a basic structure check

@patch('api.replicate_client.replicate.models') # Mock the models module in the context of replicate_client.py
def test_get_model_details_api_error(mock_replicate_models, replicate_client_instance):
    """
    Tests the case where the Replicate API returns an error when calling models.get.
    Expected that the method catches ReplicateError and returns None.
    """
    model_id = "owner/non-existent-model"

    # Set the mock to raise ReplicateError when .get() is called
    mock_replicate_models.get.side_effect = ReplicateError("Simulated API Error")

    # Call the method under test
    details_schema = replicate_client_instance.get_model_details(model_id)

    # Verify that the mocked method replicate.models.get was called
    mock_replicate_models.get.assert_called_once_with(model_id)

    # Verify that the method returned None
    assert details_schema is None

@patch('api.replicate_client.replicate.models') # Mock the models module in the context of replicate_client.py
def test_get_model_details_no_version(mock_replicate_models, replicate_client_instance):
    """
    Tests the case where the found model does not have 'latest_version'.
    Expected that the method returns None.
    """
    model_id = "owner/model-without-version"

    # Create a mock model object that does not have latest_version (or it is None)
    mock_model_no_version = MagicMock()
    mock_model_no_version.latest_version = None # Explicitly set to None

    # Set the return value for the mocked call to replicate.models.get
    mock_replicate_models.get.return_value = mock_model_no_version
    mock_replicate_models.get.side_effect = None # Cancel the side_effect from the previous test

    # Call the method under test
    details_schema = replicate_client_instance.get_model_details(model_id)

    # Verify that the mocked method replicate.models.get was called
    mock_replicate_models.get.assert_called_once_with(model_id)

    # Verify that the method returned None
    assert details_schema is None

@patch('api.replicate_client.replicate.models') # Mock the models module in the context of replicate_client.py
def test_get_model_details_no_schema(mock_replicate_models, replicate_client_instance):
    """
    Tests the case where the model has a version, but get_transformed_schema returns None.
    Expected that the method returns None.
    """
    model_id = "owner/model-without-schema"

    # Create a mock model object with a version, but get_transformed_schema returns None
    mock_model_no_schema = MagicMock()
    mock_model_no_schema.latest_version.get_transformed_schema.return_value = None

    # Set the return value for the mocked call to replicate.models.get
    mock_replicate_models.get.return_value = mock_model_no_schema
    mock_replicate_models.get.side_effect = None # Cancel the side_effect

    # Call the method under test
    details_schema = replicate_client_instance.get_model_details(model_id)

    # Verify that the mocked method replicate.models.get was called
    mock_replicate_models.get.assert_called_once_with(model_id)

    # Verify that the get_transformed_schema method was called
    mock_model_no_schema.latest_version.get_transformed_schema.assert_called_once()

    # Verify that the method returned None
    assert details_schema is None

@patch('api.replicate_client.replicate.models') # Mock the models module in the context of replicate_client.py
def test_get_model_details_unexpected_error(mock_replicate_models, replicate_client_instance):
    """
    Tests the case where an unexpected error (Exception) occurs during the API call.
    Expected that the method catches Exception and returns None.
    """
    model_id = "owner/model-causing-exception"

    # Set the mock to raise a general Exception when .get() is called
    mock_replicate_models.get.side_effect = Exception("Simulated Unexpected Error")

    # Call the method under test
    details_schema = replicate_client_instance.get_model_details(model_id)

    # Verify that the mocked method replicate.models.get was called
    mock_replicate_models.get.assert_called_once_with(model_id)

    # Verify that the method returned None
    assert details_schema is None


# Test for generate_image (to be added later)
# @patch('api.replicate_client.replicate.run')
# @patch('api.replicate_client.requests.get')
# @patch('api.replicate_client.tempfile.NamedTemporaryFile')
# def test_generate_image_success(mock_tempfile, mock_requests_get, mock_replicate_run, replicate_client_instance):
#     pass