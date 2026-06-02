import { useEffect, useState } from 'react';
import { getBranches } from '../api/branchesApi.js';
import BranchCard from '../components/cards/BranchCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';

const heroSlides = [
  {
    imageUrl: '/images/hero/worknest-hero-tel-aviv.webp',
    cityLabel: 'תל אביב',
    title: 'חללי עבודה בלב העיר',
    description: 'משרדים פרטיים וחדרי ישיבות במיקומים שמתאימים לפגישות, ריכוז ועבודה גמישה.',
  },
  {
    imageUrl: '/images/hero/worknest-hero-herzliya.webp',
    cityLabel: 'הרצליה',
    title: 'עבודה קרובה למרכזי עסקים',
    description: 'חללים נוחים לצוותים, לשיחות לקוחות וליום עבודה ממוקד ליד אזורי התעסוקה.',
  },
  {
    imageUrl: '/images/hero/worknest-hero-jerusalem.webp',
    cityLabel: 'ירושלים',
    title: 'סביבת עבודה שקטה ומזמינה',
    description: 'בחרו סניף שמתאים ליום עבודה רגוע, לפגישות צוות או לתכנון ממוקד.',
  },
  {
    imageUrl: '/images/hero/worknest-hero-haifa.webp',
    cityLabel: 'חיפה',
    title: 'יום עבודה עם מרחב לנשימה',
    description: 'מיקומים נוחים לצוותים קטנים, לפגישות יצירתיות ולשגרת עבודה גמישה.',
  },
  {
    imageUrl: '/images/hero/worknest-hero-beer-sheva.webp',
    cityLabel: 'באר שבע',
    title: 'חללי עבודה שמתחילים קרוב אליכם',
    description: 'הזמינו משרד, חדר ישיבות או סוויטת צוות ליום עבודה פשוט וברור.',
  },
];

const cityToBranchNameMap = {
  'tel-aviv': 'WorkNest Tel Aviv',
  herzliya: 'WorkNest Herzliya',
  jerusalem: 'WorkNest Jerusalem',
  haifa: 'WorkNest Haifa',
  'beer-sheva': "WorkNest Be'er Sheva",
};

const cityOptions = [
  { value: 'tel-aviv', label: 'תל אביב' },
  { value: 'herzliya', label: 'הרצליה' },
  { value: 'jerusalem', label: 'ירושלים' },
  { value: 'haifa', label: 'חיפה' },
  { value: 'beer-sheva', label: 'באר שבע' },
];

const workspaceTypeOptions = [
  { value: 'office', label: 'משרד פרטי' },
  { value: 'smallMeetingRoom', label: 'חדר ישיבות קטן' },
  { value: 'largeMeetingRoom', label: 'חדר ישיבות גדול' },
  { value: 'managedSuite', label: 'סוויטת צוות' },
];

function navigateTo(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function HomePage() {
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [cityFilter, setCityFilter] = useState('');
  const [workspaceTypeFilter, setWorkspaceTypeFilter] = useState('');
  const [failedImageUrls, setFailedImageUrls] = useState({});

  useEffect(() => {
    async function loadBranches() {
      try {
        const response = await getBranches();
        setBranches(response.data.branches);
      } catch (error) {
        setErrorMessage('משהו השתבש. נסו שוב בעוד רגע.');
      } finally {
        setIsLoading(false);
      }
    }

    loadBranches();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlideIndex((currentIndex) =>
        currentIndex === heroSlides.length - 1 ? 0 : currentIndex + 1,
      );
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  const activeSlide = heroSlides[activeSlideIndex];
  const featuredBranches = branches;

  function handlePreviousSlide() {
    setActiveSlideIndex((currentIndex) =>
      currentIndex === 0 ? heroSlides.length - 1 : currentIndex - 1,
    );
  }

  function handleNextSlide() {
    setActiveSlideIndex((currentIndex) =>
      currentIndex === heroSlides.length - 1 ? 0 : currentIndex + 1,
    );
  }

  function handleSearchSubmit(event) {
    event.preventDefault();

    if (!cityFilter) {
      navigateTo('/locations');
      return;
    }

    const targetBranchName = cityToBranchNameMap[cityFilter];
    const selectedBranch = branches.find((branch) => branch.name === targetBranchName);

    if (!selectedBranch) {
      navigateTo('/locations');
      return;
    }

    const searchParams = new URLSearchParams();

    if (workspaceTypeFilter) {
      searchParams.set('type', workspaceTypeFilter);
    }

    const nextPath = searchParams.toString()
      ? `/locations/${selectedBranch.id}?${searchParams.toString()}`
      : `/locations/${selectedBranch.id}`;

    navigateTo(nextPath);
  }

  function handleImageError(imageUrl) {
    setFailedImageUrls((currentState) => ({
      ...currentState,
      [imageUrl]: true,
    }));
  }

  return (
    <div className="section-stack public-page-layout home-page-layout">
      <section className="home-hero">
        <div className="home-hero-media">
          {heroSlides.map((slide, index) => (
            <HeroSlide
              key={slide.imageUrl}
              slide={slide}
              isVisible={index === activeSlideIndex}
              failedImageUrls={failedImageUrls}
              onImageError={handleImageError}
            />
          ))}

          <div className="carousel-controls" aria-label="ניווט קרוסלה">
            <span className="carousel-location-label">{activeSlide.cityLabel}</span>
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

          <form className="floating-search-card" onSubmit={handleSearchSubmit}>
            <div className="floating-search-copy">
              <h2 className="section-title">מצאו חלל עבודה</h2>
              <p className="page-description">בחרו עיר וסוג חלל כדי להתחיל</p>
            </div>

            <label className="floating-search-field">
              <span className="auth-field-label">עיר</span>
              <select
                className="floating-search-input"
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
              >
                <option value="">כל הערים</option>
                {cityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="floating-search-field">
              <span className="auth-field-label">סוג חלל</span>
              <select
                className="floating-search-input"
                value={workspaceTypeFilter}
                onChange={(event) => setWorkspaceTypeFilter(event.target.value)}
              >
                <option value="">כל הסוגים</option>
                {workspaceTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="floating-search-button">
              חיפוש
            </button>
          </form>
        </div>
      </section>

      <section className="section-stack">
        <div className="page-header compact-page-header">
          <span className="eyebrow">המיקומים</span>
          <h2 className="page-title section-title">חללי עבודה במיקומים מרכזיים</h2>
          <p className="page-description">
            התחילו בסניף שמתאים ללו״ז שלכם והמשיכו לבחירת משרד פרטי, חדר ישיבות או סוויטת צוות.
          </p>
        </div>

        <div className="feature-grid">
          {isLoading ? <LoadingState message="טוען סניפים נבחרים..." /> : null}
          {!isLoading && errorMessage ? <ErrorMessage message={errorMessage} /> : null}
          {!isLoading && !errorMessage && featuredBranches.length === 0 ? (
            <EmptyState message="כרגע אין סניפים להצגה." />
          ) : null}
          {!isLoading && !errorMessage
            ? featuredBranches.map((branch) => (
                <BranchCard key={branch.id} branch={branch} ctaLabel="לפרטי המיקום" />
              ))
            : null}
        </div>
      </section>
    </div>
  );
}

function HeroSlide({ slide, isVisible, failedImageUrls, onImageError }) {
  return (
    <div className={isVisible ? 'home-hero-slide home-hero-slide-visible' : 'home-hero-slide'}>
      {failedImageUrls[slide.imageUrl] ? (
        <div className="home-hero-fallback" />
      ) : (
        <img
          className="home-hero-image"
          src={slide.imageUrl}
          alt={`חלל עבודה של WorkNest ב${slide.cityLabel}`}
          loading="eager"
          onError={() => onImageError(slide.imageUrl)}
        />
      )}
    </div>
  );
}
