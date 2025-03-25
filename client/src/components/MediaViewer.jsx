import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Grid,
  Card,
  CardMedia,
  Typography,
  Box,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Download as DownloadIcon,
  PhotoLibrary as PhotoIcon,
  VideoLibrary as VideoIcon,
  InsertDriveFile as DocumentIcon,
  AudioFile as AudioIcon
} from '@mui/icons-material';

const MediaViewer = ({ post, open, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  if (!post || !post.mediaDownloads || post.mediaDownloads.length === 0) {
    return null;
  }
  
  const mediaItems = post.mediaDownloads;
  const currentItem = mediaItems[currentIndex];
  
  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? mediaItems.length - 1 : prevIndex - 1));
  };
  
  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === mediaItems.length - 1 ? 0 : prevIndex + 1));
  };
  
  const getMediaTypeIcon = (type) => {
    switch (type) {
      case 'photo':
        return <PhotoIcon />;
      case 'video':
        return <VideoIcon />;
      case 'doc':
        return <DocumentIcon />;
      case 'audio':
        return <AudioIcon />;
      default:
        return <DocumentIcon />;
    }
  };
  
  const renderMediaContent = () => {
    if (!currentItem) return null;
    
    switch (currentItem.type) {
      case 'photo':
        return (
          <CardMedia
            component="img"
            image={currentItem.s3Url}
            alt="Photo"
            sx={{ maxHeight: '80vh', objectFit: 'contain' }}
          />
        );
      case 'video':
        return (
          <CardMedia
            component="video"
            src={currentItem.s3Url}
            controls
            sx={{ maxHeight: '80vh', width: '100%' }}
          />
        );
      case 'audio':
        return (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <AudioIcon fontSize="large" sx={{ fontSize: 100, mb: 2 }} />
            <CardMedia
              component="audio"
              src={currentItem.s3Url}
              controls
            />
          </Box>
        );
      case 'doc':
        return (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <DocumentIcon fontSize="large" sx={{ fontSize: 100, mb: 2 }} />
            <Typography variant="body1" gutterBottom align="center">
              Документ: {currentItem.s3Key.split('/').pop()}
            </Typography>
            <Box mt={2}>
              <a href={currentItem.s3Url} target="_blank" rel="noopener noreferrer" download>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                >
                  Скачать документ
                </Button>
              </a>
            </Box>
          </Box>
        );
      default:
        return (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body1">
              Неподдерживаемый тип медиа: {currentItem.type}
            </Typography>
          </Box>
        );
    }
  };
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogContent sx={{ p: 1, position: 'relative' }}>
        <Box position="absolute" top={10} right={10} zIndex={10}>
          <IconButton onClick={onClose} color="inherit" sx={{ bgcolor: 'rgba(0,0,0,0.3)', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}>
            <CloseIcon />
          </IconButton>
        </Box>
        
        <Box display="flex" alignItems="center" justifyContent="center" sx={{ width: '100%', height: '100%' }}>
          {mediaItems.length > 1 && (
            <IconButton
              onClick={handlePrev}
              sx={{
                position: 'absolute',
                left: 10,
                zIndex: 2,
                bgcolor: 'rgba(0,0,0,0.3)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {renderMediaContent()}
            
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Typography variant="body2">
                {getMediaTypeIcon(currentItem.type)} {currentItem.type.charAt(0).toUpperCase() + currentItem.type.slice(1)}
              </Typography>
              
              <Typography variant="body2">
                {currentIndex + 1} / {mediaItems.length}
              </Typography>
              
              <Tooltip title="Скачать">
                <IconButton component="a" href={currentItem.s3Url} download target="_blank">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          {mediaItems.length > 1 && (
            <IconButton
              onClick={handleNext}
              sx={{
                position: 'absolute',
                right: 10,
                zIndex: 2,
                bgcolor: 'rgba(0,0,0,0.3)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' }
              }}
            >
              <ArrowForwardIcon />
            </IconButton>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default MediaViewer;
