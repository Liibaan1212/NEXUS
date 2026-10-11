import { useNavigate } from 'react-router-dom';

export default function Stub({ item }) {
  const navigate = useNavigate();
  return (
    <div className="p-space-lg">
      <div className="rounded-xl bg-surface-container-low p-space-xl max-w-xl flex flex-col gap-space-sm">
        <span className="font-label-caps text-label-caps text-outline uppercase">Not built yet</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{item.label}</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          This was part of the original design, but isn't implemented in this version. It's outside the lesson-upload-and-tracking
          scope this build focused on, and several of these (like an AI tutor chat) would need a real backend to work honestly.
        </p>
        <button onClick={() => navigate('/home')} className="self-start mt-space-xs px-space-md py-space-sm rounded bg-surface-container-high text-on-surface font-body-sm text-body-sm font-medium">
          Back to Home
        </button>
      </div>
    </div>
  );
}
