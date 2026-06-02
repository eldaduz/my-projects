import { useEffect, useState } from 'react';
import { getBranchById } from '../api/branchesApi.js';
import { getWorkspacesByBranch } from '../api/workspacesApi.js';
import WorkspaceCard from '../components/cards/WorkspaceCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import {
  getAddressDisplayName,
  getBranchDisplayName,
  getFacilityLabel,
  getPreferredImagePaths,
} from '../utils/displayLabels.js';

const branchHeroGalleryMap = {
  'WorkNest Tel Aviv': [
    '/images/branches/worknest-tel-aviv-hero-1.webp',
    '/images/branches/worknest-tel-aviv-hero-2.webp',
  ],
  'WorkNest Herzliya': [
    '/images/branches/worknest-herzliya-hero-1.webp',
    '/images/branches/worknest-herzliya-hero-2.webp',
  ],
  'WorkNest Jerusalem': [
    '/images/branches/worknest-jerusalem-hero-1.webp',
    '/images/branches/worknest-jerusalem-hero-2.webp',
  ],
  'WorkNest Haifa': [
    '/images/branches/worknest-haifa-hero-1.webp',
    '/images/branches/worknest-haifa-hero-2.webp',
  ],
  "WorkNest Be'er Sheva": [
    '/images/branches/worknest-beer-sheva-hero-1.webp',
    '/images/branches/worknest-beer-sheva-hero-2.webp',
  ],
};

function getBranchGalleryCandidates(branch) {
  if (!branch) {
    return [];
  }

  const plannedGalleryImages = branchHeroGalleryMap[branch.name] || [];
  const imageCandidates = [...plannedGalleryImages];

  if (branch.imageUrl) {
    imageCandidates.push(getPreferredImagePaths(branch.imageUrl)[0]);
  }

  return [...new Set(imageCandidates)];
}

function preloadImage(imageUrl) {
  return new Promise((resolve) => {
    const image = new window.Image();

    image.onload = () => resolve(imageUrl);
    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}

export default function LocationDetailsPage({ branchId }) {
  const [branch, setBranch] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [heroImages, setHeroImages] = useState([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const searchParams = new URLSearchParams(window.location.search);
  const selectedWorkspaceType = searchParams.get('type') || '';

  useEffect(() => {
    async function loadLocationData() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [branchResponse, workspacesResponse] = await Promise.all([
          getBranchById(branchId),
          getWorkspacesByBranch(branchId),
        ]);

        setBranch(branchResponse.data.branch);
        setWorkspaces(workspacesResponse.data.workspaces);
      } catch (error) {
        setErrorMessage('משהו השתבש. נסו שוב בעוד רגע.');
      } finally {
        setIsLoading(false);
      }
    }

    loadLocationData();
  }, [branchId]);

  useEffect(() => {
    if (!branch) {
      setHeroImages([]);
      setActiveSlideIndex(0);
      return;
    }

    let isCancelled = false;

    async function loadHeroImages() {
      const imageCandidates = getBranchGalleryCandidates(branch);

      if (imageCandidates.length === 0) {
        if (!isCancelled) {
          setHeroImages([]);
          setActiveSlideIndex(0);
        }
        return;
      }

      const loadedImages = await Promise.all(imageCandidates.map(preloadImage));
      const availableImages = loadedImages.filter(Boolean);

      if (!isCancelled) {
        setHeroImages(availableImages);
        setActiveSlideIndex(0);
      }
    }

    loadHeroImages();

    return () => {
      isCancelled = true;
    };
  }, [branch]);

  useEffect(() => {
    if (heroImages.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveSlideIndex((currentIndex) =>
        currentIndex === heroImages.length - 1 ? 0 : currentIndex + 1,
      );
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [heroImages]);

  const filteredWorkspaces = selectedWorkspaceType
    ? workspaces.filter((workspace) => workspace.type === selectedWorkspaceType)
    : workspaces;

  function handlePreviousSlide() {
    setActiveSlideIndex((currentIndex) =>
      currentIndex === 0 ? heroImages.length - 1 : currentIndex - 1,
    );
  }

  function handleNextSlide() {
    setActiveSlideIndex((currentIndex) =>
      currentIndex === heroImages.length - 1 ? 0 : currentIndex + 1,
    );
  }

  const branchRatingValue = Number(branch?.rating ?? 0);
  const roundedBranchRating = Math.max(0, Math.min(5, Math.round(branchRatingValue)));
  const branchRatingStars = `${'★'.repeat(roundedBranchRating)}${'☆'.repeat(5 - roundedBranchRating)}`;

  return (
    <section className="page-section section-stack public-page-layout location-details-page">
      {isLoading ? <LoadingState message="טוען את פרטי המיקום..." /> : null}
      {!isLoading && errorMessage ? <ErrorMessage message={errorMessage} /> : null}

      {!isLoading && !errorMessage && branch ? (
        <article className="location-hero">
          {heroImages.length > 0 ? (
            <>
              {heroImages.map((imageUrl, index) => (
                <div
                  key={imageUrl}
                  className={
                    index === activeSlideIndex
                      ? 'location-hero-slide location-hero-slide-visible'
                      : 'location-hero-slide'
                  }
                >
                  <img
                    className="location-hero-image"
                    src={imageUrl}
                    alt={getBranchDisplayName(branch.name)}
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                </div>
              ))}
            </>
          ) : (
            <div className="location-hero-fallback">
              <span className="card-image-badge">תמונה תוצג בקרוב</span>
            </div>
          )}

          {heroImages.length > 1 ? (
            <div
              className="carousel-controls location-carousel-controls"
              aria-label="ניווט גלריית מיקום"
            >
              <span className="carousel-location-label">{getBranchDisplayName(branch.name)}</span>
              <button
                type="button"
                className="carousel-arrow"
                onClick={handleNextSlide}
                aria-label="לתמונה הבאה"
              >
                ‹
              </button>
              <button
                type="button"
                className="carousel-arrow"
                onClick={handlePreviousSlide}
                aria-label="לתמונה הקודמת"
              >
                ›
              </button>
            </div>
          ) : null}

          <div className="location-hero-overlay section-stack">
            <div className="location-hero-top-row">
              <span className="eyebrow">מיקום</span>
              <div className="location-rating" aria-label={`דירוג ${branchRatingValue}/5`}>
                <span className="location-rating-stars" aria-hidden="true">
                  {branchRatingStars}
                </span>
                <span className="location-rating-value">{branch.rating}/5</span>
              </div>
            </div>
            <div className="section-stack branch-summary-heading">
              <h1 className="page-title location-hero-title">
                {getBranchDisplayName(branch.name)}
              </h1>
            </div>
            <p className="info-copy location-hero-secondary-copy">
              {getAddressDisplayName(branch.address)}
            </p>
            <div className="chip-row">
              {branch.facilities?.map((facility) => (
                <span className="info-chip" key={facility}>
                  {getFacilityLabel(facility)}
                </span>
              ))}
            </div>
          </div>
        </article>
      ) : null}

      {!isLoading && !errorMessage && filteredWorkspaces.length === 0 ? (
        <EmptyState message="לא נמצאו חללי עבודה זמינים עבור הסניף הזה." />
      ) : null}

      {!isLoading && !errorMessage && filteredWorkspaces.length > 0 ? (
        <div className="page-header compact-page-header workspace-section-header">
          <span className="eyebrow">חללי עבודה</span>
          <h2 className="section-title">בחרו את החלל המתאים ליום העבודה שלכם</h2>
          <p className="page-description">
            כל חלל מציג התאמה לצוות, מחיר יומי וציוד זמין כדי לבחור ולהזמין במהירות.
          </p>
        </div>
      ) : null}

      <div className="data-grid workspaces-grid workspace-grid-tight">
        {!isLoading && !errorMessage
          ? filteredWorkspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))
          : null}
      </div>
    </section>
  );
}
