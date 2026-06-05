import { useEffect, useState } from 'react';
import { getBranches } from '../api/branchesApi.js';
import {
  createBranch,
  createWorkspace,
  getBranchesForAdmin,
  getAllReservations,
  updateBranch,
  updateWorkspace,
} from '../api/adminApi.js';
import AdminWorkspaceForm from '../components/admin/AdminWorkspaceForm.jsx';
import AdminBranchForm from '../components/admin/AdminBranchForm.jsx';
import AdminBranchCard from '../components/cards/AdminBranchCard.jsx';
import AdminReservationCard from '../components/cards/AdminReservationCard.jsx';
import AdminWorkspaceCard from '../components/cards/AdminWorkspaceCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import {
  mapBranchErrorMessage,
  mapReservationErrorMessage,
  mapWorkspaceErrorMessage,
} from '../utils/errorMessages.js';
import { getWorkspacesByBranch } from '../api/workspacesApi.js';
import {
  getAddressDisplayName,
  getBranchDisplayName,
  getWorkspaceTypeLabel,
} from '../utils/displayLabels.js';

const TOKEN_STORAGE_KEY = 'worknestToken';
const EMPTY_BRANCH_FORM = {
  name: '',
  city: '',
  address: '',
  imageUrl: '',
  rating: '5',
  facilities: ['accessibility'],
};
const EMPTY_WORKSPACE_FORM = {
  branchId: '',
  name: '',
  type: 'office',
  capacity: '1',
  pricePerDay: '1',
  imageUrl: '',
  description: '',
  equipment: [],
};
const OVERVIEW_WORKSPACE_TYPES = ['office', 'smallMeetingRoom', 'largeMeetingRoom', 'managedSuite'];
const ADMIN_TABS = [
  { id: 'branches', label: 'מיקומים' },
  { id: 'workspaces', label: 'חללי עבודה' },
  { id: 'reservations', label: 'הזמנות' },
];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('branches');
  const [reservations, setReservations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reservationBranchFilter, setReservationBranchFilter] = useState('all');
  const [reservationSearchQuery, setReservationSearchQuery] = useState('');
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [reservationErrorMessage, setReservationErrorMessage] = useState('');
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [branchListErrorMessage, setBranchListErrorMessage] = useState('');
  const [branchForm, setBranchForm] = useState(EMPTY_BRANCH_FORM);
  const [isBranchFormOpen, setIsBranchFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [branchErrorMessage, setBranchErrorMessage] = useState('');
  const [branchSuccessMessage, setBranchSuccessMessage] = useState('');
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [selectedBranchForStatusChange, setSelectedBranchForStatusChange] = useState(null);
  const [isSavingBranchStatus, setIsSavingBranchStatus] = useState(false);
  const [selectedWorkspaceBranchId, setSelectedWorkspaceBranchId] = useState('');
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [workspaceListErrorMessage, setWorkspaceListErrorMessage] = useState('');
  const [workspaceForm, setWorkspaceForm] = useState(EMPTY_WORKSPACE_FORM);
  const [isWorkspaceFormOpen, setIsWorkspaceFormOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(null);
  const [workspaceErrorMessage, setWorkspaceErrorMessage] = useState('');
  const [workspaceSuccessMessage, setWorkspaceSuccessMessage] = useState('');
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [selectedWorkspaceToDeactivate, setSelectedWorkspaceToDeactivate] = useState(null);
  const [isDeactivatingWorkspace, setIsDeactivatingWorkspace] = useState(false);

  useEffect(() => {
    loadReservations();
  }, []);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (!selectedWorkspaceBranchId) {
      setWorkspaces([]);
      setWorkspaceListErrorMessage('');
      return;
    }

    loadWorkspaces(selectedWorkspaceBranchId);
  }, [selectedWorkspaceBranchId]);

  async function loadReservations() {
    setIsLoadingReservations(true);
    setReservationErrorMessage('');

    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const response = await getAllReservations(token);
      setReservations(response.data.reservations);
    } catch (error) {
      setReservationErrorMessage(mapReservationErrorMessage(error.message));
    } finally {
      setIsLoadingReservations(false);
    }
  }

  async function loadBranches() {
    setIsLoadingBranches(true);
    setBranchListErrorMessage('');

    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const response = token
        ? await getBranchesForAdmin(token, { includeInactive: true })
        : await getBranches();

      setBranches(response.data.branches);
    } catch (error) {
      setBranchListErrorMessage('משהו השתבש. נסו שוב בעוד רגע.');
    } finally {
      setIsLoadingBranches(false);
    }
  }

  async function loadWorkspaces(branchId) {
    setIsLoadingWorkspaces(true);
    setWorkspaceListErrorMessage('');

    try {
      const response = await getWorkspacesByBranch(branchId);
      setWorkspaces(response.data.workspaces);
    } catch (error) {
      setWorkspaceListErrorMessage(mapWorkspaceErrorMessage(error.message));
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }

  function normalizeFacilities(facilities) {
    if (facilities.includes('accessibility')) {
      return facilities;
    }

    return [...facilities, 'accessibility'];
  }

  function handleBranchFieldChange(fieldName, value) {
    setBranchForm((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }));
  }

  function handleFacilityToggle(facility) {
    if (facility === 'accessibility') {
      return;
    }

    setBranchForm((currentForm) => {
      const hasFacility = currentForm.facilities.includes(facility);
      const nextFacilities = hasFacility
        ? currentForm.facilities.filter((item) => item !== facility)
        : [...currentForm.facilities, facility];

      return {
        ...currentForm,
        facilities: normalizeFacilities(nextFacilities),
      };
    });
  }

  function resetBranchForm() {
    setBranchForm(EMPTY_BRANCH_FORM);
    setEditingBranch(null);
    setBranchErrorMessage('');
    setIsBranchFormOpen(false);
  }

  function openBranchCreateForm() {
    setBranchForm(EMPTY_BRANCH_FORM);
    setEditingBranch(null);
    setBranchErrorMessage('');
    setBranchSuccessMessage('');
    setIsBranchFormOpen(true);
  }

  function resetWorkspaceForm(nextBranchId = selectedWorkspaceBranchId) {
    setWorkspaceForm({
      ...EMPTY_WORKSPACE_FORM,
      branchId: nextBranchId || '',
    });
    setEditingWorkspace(null);
    setWorkspaceErrorMessage('');
    setIsWorkspaceFormOpen(false);
  }

  function openWorkspaceCreateForm() {
    setWorkspaceSuccessMessage('');
    setWorkspaceErrorMessage('');
    setEditingWorkspace(null);
    setWorkspaceForm({
      ...EMPTY_WORKSPACE_FORM,
      branchId: selectedWorkspaceBranchId || '',
    });
    setIsWorkspaceFormOpen(true);
  }

  function handleEditBranch(branch) {
    setEditingBranch(branch);
    setBranchErrorMessage('');
    setBranchSuccessMessage('');
    setIsBranchFormOpen(true);
    setBranchForm({
      name: branch.name,
      city: branch.city,
      address: branch.address,
      imageUrl: branch.imageUrl,
      rating: String(branch.rating),
      facilities: normalizeFacilities(branch.facilities || []),
    });
  }

  function handleWorkspaceFieldChange(fieldName, value) {
    setWorkspaceForm((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }));
  }

  function handleEquipmentToggle(equipment) {
    setWorkspaceForm((currentForm) => {
      const hasEquipment = currentForm.equipment.includes(equipment);
      const nextEquipment = hasEquipment
        ? currentForm.equipment.filter((item) => item !== equipment)
        : [...currentForm.equipment, equipment];

      return {
        ...currentForm,
        equipment: nextEquipment,
      };
    });
  }

  function handleWorkspaceBranchChange(branchId) {
    setSelectedWorkspaceBranchId(branchId);
    setWorkspaceSuccessMessage('');
    resetWorkspaceForm(branchId);
  }

  function handleEditWorkspace(workspace) {
    setEditingWorkspace(workspace);
    setWorkspaceErrorMessage('');
    setWorkspaceSuccessMessage('');
    setIsWorkspaceFormOpen(true);
    setSelectedWorkspaceBranchId(workspace.branchId);
    setWorkspaceForm({
      branchId: workspace.branchId,
      name: workspace.name,
      type: workspace.type,
      capacity: String(workspace.capacity),
      pricePerDay: String(workspace.pricePerDay),
      imageUrl: workspace.imageUrl,
      description: workspace.description,
      equipment: workspace.equipment || [],
    });
  }

  async function handleBranchSubmit(event) {
    event.preventDefault();
    setBranchErrorMessage('');
    setBranchSuccessMessage('');
    setIsSavingBranch(true);

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const branchPayload = {
      name: branchForm.name,
      city: branchForm.city,
      address: branchForm.address,
      imageUrl: branchForm.imageUrl,
      rating: Number(branchForm.rating),
      facilities: normalizeFacilities(branchForm.facilities),
    };

    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, branchPayload, token);
        setBranchSuccessMessage('המיקום עודכן בהצלחה.');
      } else {
        await createBranch(branchPayload, token);
        setBranchSuccessMessage('המיקום נוצר בהצלחה.');
      }

      resetBranchForm();
      await loadBranches();
    } catch (error) {
      setBranchErrorMessage(mapBranchErrorMessage(error.message));
    } finally {
      setIsSavingBranch(false);
    }
  }

  async function handleWorkspaceSubmit(event) {
    event.preventDefault();
    setWorkspaceErrorMessage('');
    setWorkspaceSuccessMessage('');
    setIsSavingWorkspace(true);

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const workspacePayload = {
      branchId: workspaceForm.branchId,
      name: workspaceForm.name,
      type: workspaceForm.type,
      capacity: Number(workspaceForm.capacity),
      pricePerDay: Number(workspaceForm.pricePerDay),
      imageUrl: workspaceForm.imageUrl,
      description: workspaceForm.description,
      equipment: workspaceForm.equipment,
    };

    try {
      if (editingWorkspace) {
        await updateWorkspace(editingWorkspace.id, workspacePayload, token);
        setWorkspaceSuccessMessage('חלל העבודה עודכן בהצלחה.');
      } else {
        await createWorkspace(workspacePayload, token);
        setWorkspaceSuccessMessage('חלל העבודה נוצר בהצלחה.');
      }

      resetWorkspaceForm(workspacePayload.branchId);
      await loadWorkspaces(workspacePayload.branchId);
    } catch (error) {
      setWorkspaceErrorMessage(mapWorkspaceErrorMessage(error.message));
    } finally {
      setIsSavingWorkspace(false);
    }
  }

  function openBranchStatusModal(branch) {
    setSelectedBranchForStatusChange(branch);
    setBranchErrorMessage('');
    setBranchSuccessMessage('');
  }

  function openDeactivateWorkspaceModal(workspace) {
    setSelectedWorkspaceToDeactivate(workspace);
    setWorkspaceErrorMessage('');
    setWorkspaceSuccessMessage('');
  }

  function closeBranchStatusModal() {
    if (isSavingBranchStatus) {
      return;
    }

    setSelectedBranchForStatusChange(null);
  }

  function closeDeactivateWorkspaceModal() {
    if (isDeactivatingWorkspace) {
      return;
    }

    setSelectedWorkspaceToDeactivate(null);
  }

  async function handleBranchStatusChange() {
    if (!selectedBranchForStatusChange) {
      return;
    }

    setBranchErrorMessage('');
    setBranchSuccessMessage('');
    setIsSavingBranchStatus(true);

    const nextIsActive = !selectedBranchForStatusChange.isActive;
    const successMessage = nextIsActive ? 'המיקום שוחזר בהצלחה.' : 'המיקום הושבת בהצלחה.';

    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      await updateBranch(selectedBranchForStatusChange.id, { isActive: nextIsActive }, token);

      if (editingBranch?.id === selectedBranchForStatusChange.id) {
        resetBranchForm();
      }

      setSelectedBranchForStatusChange(null);
      setBranchSuccessMessage(successMessage);
      await loadBranches();
    } catch (error) {
      setBranchErrorMessage(mapBranchErrorMessage(error.message));
    } finally {
      setIsSavingBranchStatus(false);
    }
  }

  async function handleDeactivateWorkspace() {
    if (!selectedWorkspaceToDeactivate) {
      return;
    }

    setWorkspaceErrorMessage('');
    setWorkspaceSuccessMessage('');
    setIsDeactivatingWorkspace(true);

    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      await updateWorkspace(selectedWorkspaceToDeactivate.id, { isActive: false }, token);

      if (editingWorkspace?.id === selectedWorkspaceToDeactivate.id) {
        resetWorkspaceForm(selectedWorkspaceBranchId);
      }

      setSelectedWorkspaceToDeactivate(null);
      setWorkspaceSuccessMessage('חלל העבודה הושבת בהצלחה.');
      await loadWorkspaces(selectedWorkspaceBranchId);
    } catch (error) {
      setWorkspaceErrorMessage(mapWorkspaceErrorMessage(error.message));
    } finally {
      setIsDeactivatingWorkspace(false);
    }
  }

  function getSelectedBranchSummary() {
    return activeBranches.find((branch) => branch.id === selectedWorkspaceBranchId) || null;
  }

  const activeBranches = branches.filter((branch) => branch.isActive !== false);
  const inactiveBranches = branches.filter((branch) => branch.isActive === false);
  const selectedBranchSummary = getSelectedBranchSummary();
  const confirmedReservationsCount = reservations.filter(
    (reservation) => reservation.status === 'confirmed',
  ).length;
  const cancelledReservationsCount = reservations.filter(
    (reservation) => reservation.status === 'cancelled',
  ).length;
  const workspaceTypeCounts = OVERVIEW_WORKSPACE_TYPES.map((workspaceType) => ({
    type: workspaceType,
    label: getWorkspaceTypeLabel(workspaceType),
    count: workspaces.filter((workspace) => workspace.type === workspaceType).length,
  }));
  const reservationBranchOptions = [
    ...new Set(reservations.map((reservation) => reservation.branchName)),
  ]
    .filter(Boolean)
    .sort((firstBranch, secondBranch) =>
      getBranchDisplayName(firstBranch).localeCompare(getBranchDisplayName(secondBranch), 'he'),
    );
  const normalizedReservationSearch = reservationSearchQuery.trim().toLowerCase();
  const filteredReservations = reservations
    .filter((reservation) => {
      if (statusFilter !== 'all' && reservation.status !== statusFilter) {
        return false;
      }

      if (reservationBranchFilter !== 'all' && reservation.branchName !== reservationBranchFilter) {
        return false;
      }

      if (!normalizedReservationSearch) {
        return true;
      }

      const friendlyReservationNumber = `wn-${reservation.id.slice(-6)}`;
      const searchableText = [
        friendlyReservationNumber,
        reservation.userFullName || '',
        getBranchDisplayName(reservation.branchName || ''),
        reservation.workspaceName || '',
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedReservationSearch);
    })
    .sort((firstReservation, secondReservation) => {
      const firstStatusPriority = firstReservation.status === 'cancelled' ? 1 : 0;
      const secondStatusPriority = secondReservation.status === 'cancelled' ? 1 : 0;

      if (firstStatusPriority !== secondStatusPriority) {
        return firstStatusPriority - secondStatusPriority;
      }

      const branchComparison = getBranchDisplayName(
        firstReservation.branchName || '',
      ).localeCompare(getBranchDisplayName(secondReservation.branchName || ''), 'he');

      if (branchComparison !== 0) {
        return branchComparison;
      }

      return (firstReservation.startDate || '').localeCompare(secondReservation.startDate || '');
    });

  return (
    <section className="page-section section-stack">
      <div className="page-header">
        <span className="eyebrow">ניהול מערכת</span>
        <h1 className="page-title">עמוד ניהול מערכת</h1>
        <p className="page-description">
          ניהול המערכת מחולק כעת ללשוניות ברורות כדי לעבור במהירות בין מיקומים, חללי עבודה והזמנות.
        </p>

        <div className="data-grid admin-overview-grid">
          <article className="data-card admin-overview-card admin-overview-card-kpi">
            <div className="admin-overview-card-header">
              <span className="eyebrow">הזמנות</span>
            </div>
            <div className="admin-overview-card-body">
              <strong className="admin-overview-value">{reservations.length}</strong>
              <p className="placeholder-copy">סה״כ הזמנות שנטענו למסך הניהול כרגע.</p>
            </div>
          </article>

          <article className="data-card admin-overview-card">
            <div className="admin-overview-card-header">
              <span className="eyebrow">סטטוס הזמנות</span>
            </div>
            <div className="admin-overview-card-body">
              <div className="admin-overview-status-list">
                <p className="admin-overview-status-row">
                  <span>מאושרות</span>
                  <strong>{confirmedReservationsCount}</strong>
                </p>
                <p className="admin-overview-status-row">
                  <span>מבוטלות</span>
                  <strong>{cancelledReservationsCount}</strong>
                </p>
              </div>
              <p className="placeholder-copy">חלוקת סטטוסים מתוך רשימת ההזמנות הנוכחית.</p>
            </div>
          </article>

          <article className="data-card admin-overview-card admin-overview-card-kpi">
            <div className="admin-overview-card-header">
              <span className="eyebrow">מיקומים</span>
            </div>
            <div className="admin-overview-card-body">
              <strong className="admin-overview-value">{branches.length}</strong>
              <p className="placeholder-copy">סה״כ מיקומים שנטענו כרגע למסך הניהול.</p>
            </div>
          </article>

          <article className="data-card admin-overview-card">
            <div className="admin-overview-card-header">
              <span className="eyebrow">חללי עבודה לפי סוג</span>
            </div>
            <div className="admin-overview-card-body">
              <div className="admin-overview-type-list">
                {workspaceTypeCounts.map((workspaceType) => (
                  <p className="admin-overview-type-row" key={workspaceType.type}>
                    <span>{workspaceType.label}</span>
                    <strong>{workspaceType.count}</strong>
                  </p>
                ))}
              </div>
              <p className="placeholder-copy">
                {selectedBranchSummary
                  ? `הפירוט מבוסס על ${getBranchDisplayName(selectedBranchSummary.name)}.`
                  : 'הפירוט מבוסס על חללי העבודה שכבר נטענו בלשונית חללי עבודה.'}
              </p>
            </div>
          </article>
        </div>
      </div>

      <div className="filter-row admin-tabs-row" role="tablist" aria-label="ניווט אזורי ניהול">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'filter-chip filter-chip-active' : 'filter-chip'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'branches' ? (
        <section className="section-stack">
          <div className="page-header">
            <span className="eyebrow">ניהול מיקומים</span>
            <h2 className="page-title admin-section-title">ניהול מיקומים</h2>
            <p className="page-description">
              כאן אפשר ליצור מיקום חדש, לעדכן מיקום קיים, להשבית מיקום, וגם לשחזר מיקום לא פעיל.
            </p>
          </div>

          {branchSuccessMessage ? <p className="status-note">{branchSuccessMessage}</p> : null}

          {!isBranchFormOpen ? (
            <div className="card-actions admin-branch-toolbar">
              <button type="button" className="button-link" onClick={openBranchCreateForm}>
                + יצירת מיקום חדש
              </button>
            </div>
          ) : null}

          {isBranchFormOpen ? (
            <AdminBranchForm
              formValues={branchForm}
              isEditing={Boolean(editingBranch)}
              isSaving={isSavingBranch}
              errorMessage={branchErrorMessage}
              onChange={handleBranchFieldChange}
              onFacilityToggle={handleFacilityToggle}
              onSubmit={handleBranchSubmit}
              onCancel={resetBranchForm}
            />
          ) : null}

          {isLoadingBranches ? <LoadingState message="טוען את רשימת המיקומים..." /> : null}
          {!isLoadingBranches && branchListErrorMessage ? (
            <ErrorMessage message={branchListErrorMessage} />
          ) : null}
          {!isLoadingBranches && !branchListErrorMessage && branches.length === 0 ? (
            <EmptyState message="אין כרגע מיקומים להצגה." />
          ) : null}

          <div className="data-grid">
            {!isLoadingBranches && !branchListErrorMessage
              ? branches.map((branch) => (
                  <AdminBranchCard
                    key={branch.id}
                    branch={branch}
                    onEdit={handleEditBranch}
                    onToggleActive={openBranchStatusModal}
                    isSavingStatus={
                      isSavingBranchStatus && selectedBranchForStatusChange?.id === branch.id
                    }
                  />
                ))
              : null}
          </div>

          {!isLoadingBranches && !branchListErrorMessage && inactiveBranches.length > 0 ? (
            <p className="placeholder-copy">
              מוצגים גם {inactiveBranches.length} מיקומים לא פעילים כדי לאפשר שחזור מהיר.
            </p>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'workspaces' ? (
        <section className="section-stack">
          <div className="page-header">
            <span className="eyebrow">ניהול חללי עבודה</span>
            <h2 className="page-title admin-section-title">ניהול חללי עבודה פעילים</h2>
            <p className="page-description">
              כאן בוחרים מיקום, מציגים את חללי העבודה הפעילים שלו, ויוצרים, מעדכנים או משביתים חלל
              עבודה.
            </p>
          </div>

          <article className="hero-card admin-branch-form-card">
            <div className="section-stack compact-stack">
              <label className="auth-field">
                <span className="auth-field-label">בחירת מיקום לניהול חללים</span>
                <select
                  className="auth-input"
                  value={selectedWorkspaceBranchId}
                  onChange={(event) => handleWorkspaceBranchChange(event.target.value)}
                >
                  <option value="">בחירת מיקום</option>
                  {activeBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {getBranchDisplayName(branch.name)} | {getAddressDisplayName(branch.address)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedBranchSummary ? (
                <p className="placeholder-copy">
                  מיקום נבחר: {getBranchDisplayName(selectedBranchSummary.name)} |{' '}
                  {getAddressDisplayName(selectedBranchSummary.address)}
                </p>
              ) : null}
            </div>
          </article>

          {workspaceSuccessMessage ? (
            <p className="status-note">{workspaceSuccessMessage}</p>
          ) : null}

          {selectedWorkspaceBranchId && !isWorkspaceFormOpen ? (
            <div className="card-actions admin-branch-toolbar">
              <button type="button" className="button-link" onClick={openWorkspaceCreateForm}>
                + יצירת חלל עבודה
              </button>
            </div>
          ) : null}

          {isWorkspaceFormOpen ? (
            <AdminWorkspaceForm
              branches={activeBranches}
              formValues={workspaceForm}
              isEditing={Boolean(editingWorkspace)}
              isSaving={isSavingWorkspace}
              errorMessage={workspaceErrorMessage}
              onChange={handleWorkspaceFieldChange}
              onEquipmentToggle={handleEquipmentToggle}
              onSubmit={handleWorkspaceSubmit}
              onCancel={() => resetWorkspaceForm(selectedWorkspaceBranchId)}
            />
          ) : null}

          {!selectedWorkspaceBranchId ? (
            <EmptyState message="יש לבחור מיקום כדי לנהל את חללי העבודה שלו." />
          ) : null}
          {selectedWorkspaceBranchId && isLoadingWorkspaces ? (
            <LoadingState message="טוען את חללי העבודה..." />
          ) : null}
          {selectedWorkspaceBranchId && !isLoadingWorkspaces && workspaceListErrorMessage ? (
            <ErrorMessage message={workspaceListErrorMessage} />
          ) : null}
          {selectedWorkspaceBranchId &&
          !isLoadingWorkspaces &&
          !workspaceListErrorMessage &&
          workspaces.length === 0 ? (
            <EmptyState message="אין כרגע חללי עבודה פעילים להצגה עבור המיקום שנבחר." />
          ) : null}

          <div className="data-grid">
            {selectedWorkspaceBranchId && !isLoadingWorkspaces && !workspaceListErrorMessage
              ? workspaces.map((workspace) => (
                  <AdminWorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    onEdit={handleEditWorkspace}
                    onDeactivate={openDeactivateWorkspaceModal}
                    isDeactivating={
                      isDeactivatingWorkspace && selectedWorkspaceToDeactivate?.id === workspace.id
                    }
                  />
                ))
              : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'reservations' ? (
        <section className="section-stack">
          <div className="page-header">
            <span className="eyebrow">ניהול הזמנות</span>
            <h2 className="page-title admin-section-title">ניהול הזמנות במערכת</h2>
            <p className="page-description">
              הרשימה נשארת מבוססת על נתוני ההזמנות הקיימים, אבל מוצגת כעת בתצוגה קומפקטית וקלה יותר
              לסריקה.
            </p>
          </div>

          <div className="filter-row">
            <button
              type="button"
              className={statusFilter === 'all' ? 'filter-chip filter-chip-active' : 'filter-chip'}
              onClick={() => setStatusFilter('all')}
            >
              כל ההזמנות
            </button>
            <button
              type="button"
              className={
                statusFilter === 'confirmed' ? 'filter-chip filter-chip-active' : 'filter-chip'
              }
              onClick={() => setStatusFilter('confirmed')}
            >
              מאושרות
            </button>
            <button
              type="button"
              className={
                statusFilter === 'cancelled' ? 'filter-chip filter-chip-active' : 'filter-chip'
              }
              onClick={() => setStatusFilter('cancelled')}
            >
              מבוטלות
            </button>
          </div>

          <div className="admin-reservations-toolbar">
            <label className="auth-field admin-reservations-toolbar-field">
              <span className="auth-field-label">סינון לפי מיקום</span>
              <select
                className="auth-input"
                value={reservationBranchFilter}
                onChange={(event) => setReservationBranchFilter(event.target.value)}
              >
                <option value="all">כל המיקומים</option>
                {reservationBranchOptions.map((branchName) => (
                  <option key={branchName} value={branchName}>
                    {getBranchDisplayName(branchName)}
                  </option>
                ))}
              </select>
            </label>

            <label className="auth-field admin-reservations-toolbar-field">
              <span className="auth-field-label">חיפוש מהיר</span>
              <input
                className="auth-input"
                type="text"
                value={reservationSearchQuery}
                onChange={(event) => setReservationSearchQuery(event.target.value)}
                placeholder="מספר הזמנה, משתמש, מיקום או חלל"
              />
            </label>
          </div>

          {isLoadingReservations ? <LoadingState message="טוען את כלל ההזמנות..." /> : null}
          {!isLoadingReservations && reservationErrorMessage ? (
            <ErrorMessage message={reservationErrorMessage} />
          ) : null}
          {!isLoadingReservations &&
          !reservationErrorMessage &&
          filteredReservations.length === 0 ? (
            <EmptyState message="אין כרגע הזמנות להצגה עבור המסננים שנבחרו." />
          ) : null}

          <div className="data-grid admin-reservations-grid">
            {!isLoadingReservations && !reservationErrorMessage
              ? filteredReservations.map((reservation) => (
                  <AdminReservationCard key={reservation.id} reservation={reservation} />
                ))
              : null}
          </div>
        </section>
      ) : null}

      {selectedBranchForStatusChange ? (
        <div className="modal-backdrop" onClick={closeBranchStatusModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {selectedBranchForStatusChange.isActive ? 'השבתת מיקום' : 'שחזור מיקום'}
              </h3>
              <button
                type="button"
                className="modal-close-button"
                onClick={closeBranchStatusModal}
                disabled={isSavingBranchStatus}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="section-stack compact-stack">
                <p className="placeholder-copy">
                  {selectedBranchForStatusChange.isActive
                    ? 'האם להשבית את המיקום? משתמשים לא יראו אותו יותר ברשימת המיקומים.'
                    : 'האם לשחזר את המיקום? לאחר השחזור הוא יחזור להופיע ברשימת המיקומים.'}
                </p>

                <div className="card-actions">
                  <button
                    type="button"
                    className="button-link-secondary"
                    onClick={closeBranchStatusModal}
                    disabled={isSavingBranchStatus}
                  >
                    לא, חזרה
                  </button>
                  <button
                    type="button"
                    className="button-link"
                    onClick={handleBranchStatusChange}
                    disabled={isSavingBranchStatus}
                  >
                    {isSavingBranchStatus
                      ? selectedBranchForStatusChange.isActive
                        ? 'משבית...'
                        : 'משחזר...'
                      : selectedBranchForStatusChange.isActive
                        ? 'כן, השבת מיקום'
                        : 'כן, שחזר מיקום'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedWorkspaceToDeactivate ? (
        <div className="modal-backdrop" onClick={closeDeactivateWorkspaceModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">השבתת חלל עבודה</h3>
              <button
                type="button"
                className="modal-close-button"
                onClick={closeDeactivateWorkspaceModal}
                disabled={isDeactivatingWorkspace}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="section-stack compact-stack">
                <p className="placeholder-copy">
                  האם להשבית את חלל העבודה? משתמשים לא יראו אותו יותר ברשימת החללים.
                </p>

                <div className="card-actions">
                  <button
                    type="button"
                    className="button-link-secondary"
                    onClick={closeDeactivateWorkspaceModal}
                    disabled={isDeactivatingWorkspace}
                  >
                    לא, חזרה
                  </button>
                  <button
                    type="button"
                    className="button-link"
                    onClick={handleDeactivateWorkspace}
                    disabled={isDeactivatingWorkspace}
                  >
                    {isDeactivatingWorkspace ? 'משבית...' : 'כן, השבת חלל'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
