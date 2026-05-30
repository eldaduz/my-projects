import { useEffect, useState } from 'react';
import { getBranches } from '../api/branchesApi.js';
import BranchCard from '../components/cards/BranchCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';

export default function LocationsPage() {
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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

  return (
    <section className="page-section section-stack public-page-layout locations-page-layout">
      <div className="page-header">
        <span className="eyebrow">מיקומים</span>
        <h1 className="page-title">מצאו את מיקום העבודה הבא שלכם</h1>
        <p className="page-description">
          סניפי WorkNest נבחרו כדי לתת לכם גישה למשרדים פרטיים, חדרי ישיבות וסוויטות צוות במיקומים
          מרכזיים.
        </p>
      </div>

      {isLoading ? <LoadingState message="טוען את רשימת המיקומים..." /> : null}
      {!isLoading && errorMessage ? <ErrorMessage message={errorMessage} /> : null}
      {!isLoading && !errorMessage && branches.length === 0 ? (
        <EmptyState message="לא נמצאו מיקומים זמינים כרגע." />
      ) : null}

      <div className="data-grid branches-grid locations-grid">
        {!isLoading && !errorMessage
          ? branches.map((branch) => <BranchCard key={branch.id} branch={branch} />)
          : null}
      </div>
    </section>
  );
}
