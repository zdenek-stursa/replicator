import pytest
import os
import tempfile
import time
from unittest.mock import patch, MagicMock
from PIL import Image
from utils.image_converter import ImageConverter


class TestImageConverter:
    """Test cases for ImageConverter class"""
    
    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for tests"""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield temp_dir
    
    @pytest.fixture
    def sample_webp_image(self, temp_dir):
        """Create a sample WebP image for testing"""
        # Create a simple test image
        img = Image.new('RGB', (100, 100), color='red')
        webp_path = os.path.join(temp_dir, 'test.webp')
        img.save(webp_path, 'WEBP')
        return webp_path
    
    @pytest.fixture
    def converter(self, temp_dir):
        """Create ImageConverter instance with test temp directory"""
        return ImageConverter(temp_dir=temp_dir, cleanup_interval=1, max_age=2)
    
    def test_convert_to_jpg_success(self, converter, sample_webp_image):
        """Test successful conversion to JPEG"""
        result_path = converter.convert_to_jpg(sample_webp_image, quality=90)
        
        # Check that file was created
        assert os.path.exists(result_path)
        assert result_path.endswith('.jpg')
        
        # Check that it's a valid JPEG
        with Image.open(result_path) as img:
            assert img.format == 'JPEG'
            assert img.mode == 'RGB'
        
        # Check that file is tracked
        info = converter.get_temp_file_info()
        assert info['total_files'] == 1
    
    def test_convert_to_png_success(self, converter, sample_webp_image):
        """Test successful conversion to PNG"""
        result_path = converter.convert_to_png(sample_webp_image)
        
        # Check that file was created
        assert os.path.exists(result_path)
        assert result_path.endswith('.png')
        
        # Check that it's a valid PNG
        with Image.open(result_path) as img:
            assert img.format == 'PNG'
            assert img.mode == 'RGB'
        
        # Check that file is tracked
        info = converter.get_temp_file_info()
        assert info['total_files'] == 1
    
    def test_convert_nonexistent_file(self, converter):
        """Test conversion of non-existent file"""
        with pytest.raises(ValueError, match="Source file does not exist"):
            converter.convert_to_jpg("/nonexistent/file.webp")
        
        with pytest.raises(ValueError, match="Source file does not exist"):
            converter.convert_to_png("/nonexistent/file.webp")
    
    def test_convert_rgba_image(self, converter, temp_dir):
        """Test conversion of RGBA image (with transparency)"""
        # Create RGBA image with transparency
        img = Image.new('RGBA', (100, 100), color=(255, 0, 0, 128))
        rgba_path = os.path.join(temp_dir, 'test_rgba.png')
        img.save(rgba_path, 'PNG')
        
        # Convert to JPEG (should remove transparency)
        jpg_path = converter.convert_to_jpg(rgba_path)
        with Image.open(jpg_path) as result:
            assert result.format == 'JPEG'
            assert result.mode == 'RGB'
        
        # Convert to PNG (should remove transparency)
        png_path = converter.convert_to_png(rgba_path)
        with Image.open(png_path) as result:
            assert result.format == 'PNG'
            assert result.mode == 'RGB'
    
    def test_cleanup_old_files(self, converter, sample_webp_image):
        """Test cleanup of old temporary files"""
        # Create some temp files
        jpg_path = converter.convert_to_jpg(sample_webp_image)
        png_path = converter.convert_to_png(sample_webp_image)
        
        # Verify files exist and are tracked
        assert os.path.exists(jpg_path)
        assert os.path.exists(png_path)
        info = converter.get_temp_file_info()
        assert info['total_files'] == 2
        
        # Manually set old timestamps to simulate old files
        old_time = time.time() - 10  # 10 seconds ago
        converter.temp_files[jpg_path] = old_time
        converter.temp_files[png_path] = old_time
        
        # Run cleanup
        cleaned_count = converter.cleanup_old_files()
        
        # Check that files were cleaned up
        assert cleaned_count == 2
        assert not os.path.exists(jpg_path)
        assert not os.path.exists(png_path)
        
        info = converter.get_temp_file_info()
        assert info['total_files'] == 0
    
    def test_get_temp_file_info(self, converter, sample_webp_image):
        """Test getting temporary file information"""
        # Initially no files
        info = converter.get_temp_file_info()
        assert info['total_files'] == 0
        assert info['old_files'] == 0
        assert 'temp_dir' in info
        assert 'max_age_seconds' in info
        assert 'cleanup_interval_seconds' in info
        
        # Create a file
        converter.convert_to_jpg(sample_webp_image)
        info = converter.get_temp_file_info()
        assert info['total_files'] == 1
        assert info['old_files'] == 0
    
    def test_jpeg_quality_parameter(self, converter, sample_webp_image):
        """Test JPEG quality parameter"""
        # Convert with different quality settings
        high_quality_path = converter.convert_to_jpg(sample_webp_image, quality=95)
        low_quality_path = converter.convert_to_jpg(sample_webp_image, quality=50)
        
        # Both should be valid JPEG files
        assert os.path.exists(high_quality_path)
        assert os.path.exists(low_quality_path)
        
        # High quality file should generally be larger (though this isn't guaranteed for all images)
        high_size = os.path.getsize(high_quality_path)
        low_size = os.path.getsize(low_quality_path)
        
        # At minimum, both should be valid JPEG files
        with Image.open(high_quality_path) as img:
            assert img.format == 'JPEG'
        with Image.open(low_quality_path) as img:
            assert img.format == 'JPEG'
    
    @patch('utils.image_converter.Image.open')
    def test_conversion_error_handling(self, mock_open, converter, sample_webp_image):
        """Test error handling during conversion"""
        # Mock PIL to raise an exception
        mock_open.side_effect = Exception("PIL error")
        
        with pytest.raises(ValueError, match="Image conversion to JPEG failed"):
            converter.convert_to_jpg(sample_webp_image)
        
        with pytest.raises(ValueError, match="Image conversion to PNG failed"):
            converter.convert_to_png(sample_webp_image)
