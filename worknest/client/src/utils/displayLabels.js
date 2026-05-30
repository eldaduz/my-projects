const BRANCH_NAME_LABELS = {
  'WorkNest Tel Aviv': 'WorkNest תל אביב',
  'WorkNest Herzliya': 'WorkNest הרצליה',
  'WorkNest Jerusalem': 'WorkNest ירושלים',
  'WorkNest Haifa': 'WorkNest חיפה',
  "WorkNest Be'er Sheva": 'WorkNest באר שבע',
};

const CITY_LABELS = {
  'Tel Aviv': 'תל אביב',
  Herzliya: 'הרצליה',
  Jerusalem: 'ירושלים',
  Haifa: 'חיפה',
  "Be'er Sheva": 'באר שבע',
};

const ADDRESS_LABELS = {
  'Rothschild Boulevard 22, Tel Aviv': 'שדרות רוטשילד 22',
  'Abba Eban Boulevard 12, Herzliya': 'שדרות אבא אבן 12',
  'Jaffa Road 89, Jerusalem': 'דרך יפו 89',
  'HaNamal Street 31, Haifa': 'רחוב הנמל 31',
  'Hanassi Boulevard 45, Haifa': 'שדרות הנשיא 45',
  "Rager Boulevard 54, Be'er Sheva": 'שדרות רגר 54',
  "Rager Boulevard 41, Be'er Sheva": 'שדרות רגר 41',
};

const FACILITY_LABELS = {
  wifi: 'Wi-Fi',
  coffee: 'קפה',
  printer: 'מדפסת',
  kitchen: 'מטבח',
  parking: 'חניה',
  bikeStorage: 'חניית אופניים',
  petFriendly: 'ידידותי לחיות',
  accessibility: 'נגישות',
};

const WORKSPACE_TYPE_LABELS = {
  office: 'משרד פרטי',
  smallMeetingRoom: 'חדר ישיבות קטן',
  largeMeetingRoom: 'חדר ישיבות גדול',
  managedSuite: 'סוויטת צוות',
};

const WORKSPACE_NAME_LABELS = {
  'Office A': 'משרד פרטי A',
  'Office B': 'משרד פרטי B',
  'Small Meeting Room A': 'חדר ישיבות קטן A',
  'Small Meeting Room B': 'חדר ישיבות קטן B',
  'Large Meeting Room A': 'חדר ישיבות גדול A',
  'Large Meeting Room B': 'חדר ישיבות גדול B',
  'Managed Suite A': 'סוויטת צוות A',
  'Managed Suite B': 'סוויטת צוות B',
};

const WORKSPACE_IMAGE_BASENAMES = {
  'Office A': 'office-a',
  'Office B': 'office-b',
  'Small Meeting Room A': 'small-meeting-room-a',
  'Small Meeting Room B': 'small-meeting-room-b',
  'Large Meeting Room A': 'large-meeting-room-a',
  'Large Meeting Room B': 'large-meeting-room-b',
  'Managed Suite A': 'managed-suite-a',
  'Managed Suite B': 'managed-suite-b',
  'משרד פרטי A': 'office-a',
  'משרד פרטי B': 'office-b',
  'חדר ישיבות קטן A': 'small-meeting-room-a',
  'חדר ישיבות קטן B': 'small-meeting-room-b',
  'חדר ישיבות גדול A': 'large-meeting-room-a',
  'חדר ישיבות גדול B': 'large-meeting-room-b',
  'סוויטת צוות A': 'managed-suite-a',
  'סוויטת צוות B': 'managed-suite-b',
};

const WORKSPACE_DESCRIPTION_LABELS = {
  'A private office for focused work or a small team.': 'משרד פרטי לעבודה שקטה או לצוות קטן.',
  'A compact meeting room for interviews, client calls, and team syncs.':
    'חדר ישיבות קומפקטי לפגישות, ראיונות ושיחות צוות.',
  'A practical meeting room for small presentations and focused team discussions.':
    'חדר ישיבות פרקטי למצגות קצרות ודיוני צוות ממוקדים.',
  'A larger meeting room for workshops, presentations, and team sessions.':
    'חדר ישיבות רחב לסדנאות, מצגות ופגישות צוות גדולות.',
  'A private suite for a larger team, combining work areas and meeting space.':
    'סוויטה פרטית לצוות גדול, עם אזור עבודה ואזור ישיבות.',
};

const EQUIPMENT_LABELS = {
  projector: 'מקרן',
  largeTv: 'מסך גדול',
};

const RESERVATION_STATUS_LABELS = {
  confirmed: 'מאושרת',
  cancelled: 'מבוטלת',
};

// Backend values stay stable in English, and the UI maps them only for display.
function getMappedLabel(value, labelsMap) {
  if (!value) {
    return value;
  }

  return labelsMap[value] || value;
}

export function getBranchDisplayName(branchName) {
  return getMappedLabel(branchName, BRANCH_NAME_LABELS);
}

export function getCityDisplayName(city) {
  return getMappedLabel(city, CITY_LABELS);
}

export function getAddressDisplayName(address) {
  return getMappedLabel(address, ADDRESS_LABELS);
}

export function getFacilityLabel(facility) {
  return getMappedLabel(facility, FACILITY_LABELS);
}

export function getWorkspaceTypeLabel(type) {
  return getMappedLabel(type, WORKSPACE_TYPE_LABELS);
}

export function getWorkspaceDisplayName(name) {
  return getMappedLabel(name, WORKSPACE_NAME_LABELS);
}

export function getWorkspaceDescription(description) {
  return getMappedLabel(description, WORKSPACE_DESCRIPTION_LABELS);
}

export function getWorkspaceImagePath(name) {
  const workspaceImagePaths = getWorkspaceImagePaths(name);

  return workspaceImagePaths[0] || '';
}

export function getWorkspaceImagePaths(name) {
  if (!name) {
    return [];
  }

  const imageBaseName = WORKSPACE_IMAGE_BASENAMES[name];

  if (!imageBaseName) {
    return [];
  }

  return [`/images/workspaces/${imageBaseName}.jpg`, `/images/workspaces/${imageBaseName}.png`];
}

export function getEquipmentLabel(equipment) {
  return getMappedLabel(equipment, EQUIPMENT_LABELS);
}

export function getReservationStatusLabel(status) {
  return getMappedLabel(status, RESERVATION_STATUS_LABELS);
}
