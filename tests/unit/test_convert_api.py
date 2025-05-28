import pytest
import os
import tempfile
import json
from unittest.mock import patch, MagicMock
from PIL import Image
from app import app


class TestConvertAPI:
    """Test cases for image conversion API endpoints"""

    @pytest.fixture
    def client(self):
        """Create test client"""
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    @pytest.fixture
    def sample_image_id(self):
        """Use existing sample image ID"""
        return "14a65d6e-1447-4d91-9aac-75de2e77f571"

    @pytest.fixture
    def create_test_image(self, sample_image_id):
        """Create a test image file for testing"""
        import tempfile
        from PIL import Image

        # Create a simple test image
        img = Image.new('RGB', (100, 100), color='red')

        # Save to the images directory
        image_path = os.path.join(app.config['IMAGE_STORAGE_PATH'], f"{sample_image_id}.webp")
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        img.save(image_path, 'WEBP')

        yield image_path

        # Cleanup
        if os.path.exists(image_path):
            os.remove(image_path)

    def test_convert_to_jpg_success(self, client, sample_image_id, create_test_image):
        """Test successful conversion to JPEG"""
        response = client.get(f'/api/convert/{sample_image_id}/jpg')

        assert response.status_code == 200
        assert response.mimetype == 'image/jpeg'
        assert 'attachment' in response.headers.get('Content-Disposition', '')
        assert f'{sample_image_id}.jpg' in response.headers.get('Content-Disposition', '')

    def test_convert_to_png_success(self, client, sample_image_id, create_test_image):
        """Test successful conversion to PNG"""
        response = client.get(f'/api/convert/{sample_image_id}/png')

        assert response.status_code == 200
        assert response.mimetype == 'image/png'
        assert 'attachment' in response.headers.get('Content-Disposition', '')
        assert f'{sample_image_id}.png' in response.headers.get('Content-Disposition', '')

    def test_convert_unsupported_format(self, client, sample_image_id):
        """Test conversion with unsupported format"""
        response = client.get(f'/api/convert/{sample_image_id}/gif')

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['error'] == 'Bad request'
        assert 'Unsupported format' in data['message']
        assert data['type'] == 'BadRequestError'

    def test_convert_nonexistent_image(self, client):
        """Test conversion of non-existent image"""
        response = client.get('/api/convert/nonexistent-id/jpg')

        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['error'] == 'Not found'
        assert 'Image not found' in data['message']
        assert data['type'] == 'NotFoundError'

    def test_temp_files_info_endpoint(self, client):
        """Test temporary files info endpoint"""
        response = client.get('/api/temp-files-info')

        assert response.status_code == 200
        data = json.loads(response.data)

        # Check required fields
        assert 'total_files' in data
        assert 'old_files' in data
        assert 'temp_dir' in data
        assert 'max_age_seconds' in data
        assert 'cleanup_interval_seconds' in data

        # Check data types
        assert isinstance(data['total_files'], int)
        assert isinstance(data['old_files'], int)
        assert isinstance(data['temp_dir'], str)
        assert isinstance(data['max_age_seconds'], int)
        assert isinstance(data['cleanup_interval_seconds'], int)

    @patch('app.image_converter.convert_to_jpg')
    def test_convert_jpg_error_handling(self, mock_convert, client, sample_image_id, create_test_image):
        """Test error handling during JPEG conversion"""
        mock_convert.side_effect = ValueError("Conversion failed")

        response = client.get(f'/api/convert/{sample_image_id}/jpg')

        assert response.status_code == 500
        data = json.loads(response.data)
        # Flask error handler converts specific errors to generic message
        assert data['error'] == 'Internal server error'
        assert data['type'] == 'InternalServerError'

    @patch('app.image_converter.convert_to_png')
    def test_convert_png_error_handling(self, mock_convert, client, sample_image_id, create_test_image):
        """Test error handling during PNG conversion"""
        mock_convert.side_effect = ValueError("Conversion failed")

        response = client.get(f'/api/convert/{sample_image_id}/png')

        assert response.status_code == 500
        data = json.loads(response.data)
        # Flask error handler converts specific errors to generic message
        assert data['error'] == 'Internal server error'
        assert data['type'] == 'InternalServerError'

    def test_rate_limiting_convert_endpoint(self, client, sample_image_id, create_test_image):
        """Test rate limiting on convert endpoint (basic test)"""
        # This test just verifies the endpoint responds normally
        # Full rate limiting testing would require more complex setup
        response = client.get(f'/api/convert/{sample_image_id}/jpg')

        # Should work normally (not hitting rate limit in single request)
        assert response.status_code == 200

    def test_rate_limiting_temp_files_info(self, client):
        """Test rate limiting on temp files info endpoint (basic test)"""
        response = client.get('/api/temp-files-info')

        # Should work normally (not hitting rate limit in single request)
        assert response.status_code == 200

    def test_convert_endpoint_case_sensitivity(self, client, sample_image_id):
        """Test that format parameter is case sensitive"""
        # Test uppercase format (should fail)
        response = client.get(f'/api/convert/{sample_image_id}/JPG')
        assert response.status_code == 400

        response = client.get(f'/api/convert/{sample_image_id}/PNG')
        assert response.status_code == 400

        # Test mixed case (should fail)
        response = client.get(f'/api/convert/{sample_image_id}/Jpg')
        assert response.status_code == 400

    def test_convert_endpoint_with_special_characters(self, client):
        """Test convert endpoint with special characters in image ID"""
        # Test with various special characters that might cause issues
        special_ids = [
            "test-with-dashes",
            "test_with_underscores",
            "test.with.dots",
            "test%20with%20spaces",  # URL encoded spaces
        ]

        for image_id in special_ids:
            response = client.get(f'/api/convert/{image_id}/jpg')
            # Should return 404 (not found) rather than 400 (bad request)
            # This confirms the endpoint properly handles the image ID
            assert response.status_code == 404
            data = json.loads(response.data)
            assert data['type'] == 'NotFoundError'
