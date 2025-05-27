import os
import tempfile
import logging
from typing import Optional, Tuple
from PIL import Image
import time
import threading
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ImageConverter:
    """
    Handles image format conversion with temporary file management
    """
    
    def __init__(self, temp_dir: Optional[str] = None, cleanup_interval: int = 3600, max_age: int = 7200):
        """
        Initialize image converter
        
        Args:
            temp_dir: Directory for temporary files (None for system temp)
            cleanup_interval: Cleanup interval in seconds (default: 1 hour)
            max_age: Maximum age of temp files in seconds (default: 2 hours)
        """
        self.temp_dir = temp_dir or tempfile.gettempdir()
        self.cleanup_interval = cleanup_interval
        self.max_age = max_age
        self.temp_files = {}  # Track temporary files with timestamps
        self._cleanup_lock = threading.Lock()
        
        # Ensure temp directory exists
        os.makedirs(self.temp_dir, exist_ok=True)
        
        # Start cleanup thread
        self._start_cleanup_thread()
        
        logger.info(f"ImageConverter initialized with temp_dir: {self.temp_dir}")
    
    def convert_to_jpg(self, source_path: str, quality: int = 90) -> str:
        """
        Convert image to JPEG format
        
        Args:
            source_path: Path to source image file
            quality: JPEG quality (1-100, default: 90)
            
        Returns:
            Path to converted temporary file
            
        Raises:
            ValueError: If source file doesn't exist or conversion fails
            OSError: If file operations fail
        """
        if not os.path.exists(source_path):
            raise ValueError(f"Source file does not exist: {source_path}")
        
        try:
            # Generate temporary filename
            temp_fd, temp_path = tempfile.mkstemp(suffix='.jpg', dir=self.temp_dir)
            os.close(temp_fd)  # Close file descriptor, we'll use PIL to write
            
            # Open and convert image
            with Image.open(source_path) as img:
                # Convert to RGB if necessary (removes transparency)
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Create white background for transparent images
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = rgb_img
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Save as JPEG with specified quality
                img.save(temp_path, 'JPEG', quality=quality, optimize=True)
            
            # Track temporary file
            self._track_temp_file(temp_path)
            
            logger.info(f"Converted {source_path} to JPEG: {temp_path}")
            return temp_path
            
        except Exception as e:
            # Clean up temp file if it was created
            if 'temp_path' in locals() and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass
            logger.error(f"Failed to convert {source_path} to JPEG: {str(e)}")
            raise ValueError(f"Image conversion to JPEG failed: {str(e)}")
    
    def convert_to_png(self, source_path: str) -> str:
        """
        Convert image to PNG format without transparency
        
        Args:
            source_path: Path to source image file
            
        Returns:
            Path to converted temporary file
            
        Raises:
            ValueError: If source file doesn't exist or conversion fails
            OSError: If file operations fail
        """
        if not os.path.exists(source_path):
            raise ValueError(f"Source file does not exist: {source_path}")
        
        try:
            # Generate temporary filename
            temp_fd, temp_path = tempfile.mkstemp(suffix='.png', dir=self.temp_dir)
            os.close(temp_fd)  # Close file descriptor, we'll use PIL to write
            
            # Open and convert image
            with Image.open(source_path) as img:
                # Convert to RGB (removes transparency)
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Create white background for transparent images
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = rgb_img
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Save as PNG
                img.save(temp_path, 'PNG', optimize=True)
            
            # Track temporary file
            self._track_temp_file(temp_path)
            
            logger.info(f"Converted {source_path} to PNG: {temp_path}")
            return temp_path
            
        except Exception as e:
            # Clean up temp file if it was created
            if 'temp_path' in locals() and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass
            logger.error(f"Failed to convert {source_path} to PNG: {str(e)}")
            raise ValueError(f"Image conversion to PNG failed: {str(e)}")
    
    def _track_temp_file(self, file_path: str) -> None:
        """Track temporary file with timestamp"""
        with self._cleanup_lock:
            self.temp_files[file_path] = time.time()
    
    def _start_cleanup_thread(self) -> None:
        """Start background thread for cleaning up old temporary files"""
        def cleanup_worker():
            while True:
                try:
                    time.sleep(self.cleanup_interval)
                    self.cleanup_old_files()
                except Exception as e:
                    logger.error(f"Error in cleanup thread: {str(e)}")
        
        cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        cleanup_thread.start()
        logger.info("Cleanup thread started")
    
    def cleanup_old_files(self) -> int:
        """
        Clean up old temporary files
        
        Returns:
            Number of files cleaned up
        """
        cleaned_count = 0
        current_time = time.time()
        
        with self._cleanup_lock:
            files_to_remove = []
            
            for file_path, creation_time in self.temp_files.items():
                if current_time - creation_time > self.max_age:
                    try:
                        if os.path.exists(file_path):
                            os.unlink(file_path)
                            cleaned_count += 1
                            logger.debug(f"Cleaned up old temp file: {file_path}")
                    except OSError as e:
                        logger.warning(f"Failed to remove temp file {file_path}: {str(e)}")
                    
                    files_to_remove.append(file_path)
            
            # Remove from tracking
            for file_path in files_to_remove:
                del self.temp_files[file_path]
        
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} old temporary files")
        
        return cleaned_count
    
    def get_temp_file_info(self) -> dict:
        """
        Get information about tracked temporary files
        
        Returns:
            Dictionary with temp file statistics
        """
        with self._cleanup_lock:
            current_time = time.time()
            total_files = len(self.temp_files)
            old_files = sum(1 for creation_time in self.temp_files.values() 
                          if current_time - creation_time > self.max_age)
            
            return {
                'total_files': total_files,
                'old_files': old_files,
                'temp_dir': self.temp_dir,
                'max_age_seconds': self.max_age,
                'cleanup_interval_seconds': self.cleanup_interval
            }
