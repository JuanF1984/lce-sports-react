import { useState, useCallback, useEffect } from 'react';

export const useImageLoading = (imageCount = 1) => {
    const [loadedImages, setLoadedImages] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const handleImageLoad = useCallback(() => {
        setLoadedImages(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (loadedImages >= imageCount) {
            setIsLoading(false);
        }
    }, [loadedImages, imageCount]);

    const reset = useCallback(() => {
        setLoadedImages(0);
        setIsLoading(true);
    }, []);

    return {
        isLoading,
        handleImageLoad,
        loadedImages,
        reset
    };
};