import { useEffect, useRef, useState } from 'react';
import clownLaughSound from '../../../assets/sound/clown_laugh.mp3';
import clownImage from '../../../assets/items/illusions/clown.png';

export const sendInTheClown = {
  key: 'send_in_the_clown',
  name: 'Send in the Clown',
  category: 'illusion',
  description: 'A lurking jester marks a row; when it arrives, the fear is real.',
};

export const useClownJumpscare = () => {
  const [showClownOverlay, setShowClownOverlay] = useState(false);
  const clownAudioRef = useRef(null);

  useEffect(() => {
    clownAudioRef.current = new Audio(clownLaughSound);
    clownAudioRef.current.volume = 0.7;
    return () => {
      if (clownAudioRef.current) {
        clownAudioRef.current.pause();
        clownAudioRef.current = null;
      }
    };
  }, []);

  const triggerClown = () => {
    setShowClownOverlay(true);
    if (clownAudioRef.current) {
      clownAudioRef.current.currentTime = 0;
      clownAudioRef.current.play().catch(() => {});
    }
    setTimeout(() => setShowClownOverlay(false), 1400);
  };

  return { showClownOverlay, triggerClown };
};

export const ClownOverlay = ({ show }) => {
  if (!show) return null;
  return (
    <div className="clown-overlay">
      <div className="clown-flash">
        <img src={clownImage} alt="Clown" className="clown-image" />
      </div>
    </div>
  );
};
