import { useEffect } from 'react'


export const CarruselCommonModal = ({
    isOpen,
    onClose,
    onNext,
    onPrev,
    children
}) => {
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyPress);
            return () => window.removeEventListener('keydown', handleKeyPress);
        }
    }, [isOpen, onNext, onPrev, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <span className="close" onClick={onClose}>&times;</span>
            <a className="prev" onClick={onPrev}>&#10094;</a>
            {/* <img className="modal-content" src={image} alt="Modal" /> */}
            <a className="next" onClick={onNext}>&#10095;</a>
            {children}
        </div>
    );
}
