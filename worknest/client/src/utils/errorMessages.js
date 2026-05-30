const AUTH_ERROR_MESSAGES = {
  'Email and password are required': 'יש להזין אימייל וסיסמה.',
  'Invalid email or password': 'האימייל או הסיסמה אינם נכונים.',
  'Full name is required': 'יש להזין שם מלא.',
  'Valid email is required': 'יש להזין כתובת אימייל תקינה.',
  'Password does not meet the required rules':
    'הסיסמה חייבת לכלול לפחות 8 תווים, אות גדולה, אות קטנה ומספר.',
  'Email already exists': 'קיים כבר משתמש עם כתובת האימייל הזו.',
  'Token is missing': 'יש להתחבר כדי לבצע פעולה זו.',
  'Token is invalid or expired': 'פג תוקף ההתחברות. יש להתחבר מחדש.',
  'User not found': 'פג תוקף ההתחברות. יש להתחבר מחדש.',
};

const SESSION_ERROR_MESSAGES = [
  'Token is missing',
  'Token is invalid or expired',
  'User not found',
];

const RESERVATION_ERROR_MESSAGES = {
  'Branch ID is required': 'יש לבחור מיקום.',
  'Workspace ID is required': 'יש לבחור חלל עבודה.',
  'Start date and end date are required': 'יש לבחור תאריך התחלה ותאריך סיום.',
  'Invalid date format': 'פורמט התאריך אינו תקין.',
  'Invalid reservation status': 'סטטוס ההזמנה אינו תקין.',
  'End date must be after start date': 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה.',
  'Start date cannot be in the past': 'לא ניתן לבחור תאריך התחלה שכבר עבר.',
  'Branch not found': 'המיקום לא נמצא.',
  'Workspace not found': 'חלל העבודה לא נמצא.',
  'Workspace does not belong to the selected branch': 'חלל העבודה אינו שייך למיקום שנבחר.',
  'Workspace is not available for the selected dates': 'חלל העבודה אינו פנוי בתאריכים שנבחרו.',
  'Token is missing': 'יש להתחבר כדי לבצע פעולה זו.',
  'Token is invalid or expired': 'פג תוקף ההתחברות. יש להתחבר מחדש.',
  'Reservation not found': 'ההזמנה לא נמצאה.',
  'Reservation is already cancelled': 'ההזמנה כבר מבוטלת.',
  'Access denied': 'אין לך הרשאה לבצע פעולה זו.',
};

const BRANCH_ERROR_MESSAGES = {
  'Branch name is required': 'יש להזין שם מיקום.',
  'City is required': 'יש להזין עיר.',
  'Address is required': 'יש להזין כתובת.',
  'Image URL is required': 'יש להזין כתובת תמונה.',
  'Rating must be between 1 and 5': 'הדירוג חייב להיות בין 1 ל-5.',
  'Facilities must include accessibility': 'יש לכלול נגישות במתקני המיקום.',
  'Facilities must be an array': 'רשימת המתקנים אינה תקינה.',
  'Invalid facility value': 'אחד מהמתקנים שנבחרו אינו תקין.',
  'Branch already exists': 'מיקום כזה כבר קיים.',
  'Token is missing': 'יש להתחבר כדי לבצע פעולה זו.',
  'Token is invalid or expired': 'פג תוקף ההתחברות. יש להתחבר מחדש.',
  'Access denied': 'אין לך הרשאה לבצע פעולה זו.',
  'Branch not found': 'המיקום לא נמצא.',
};

const WORKSPACE_ERROR_MESSAGES = {
  'Branch ID is required': 'יש לבחור מיקום.',
  'Branch not found': 'המיקום לא נמצא.',
  'Workspace name is required': 'יש להזין שם חלל עבודה.',
  'Invalid workspace type': 'סוג חלל העבודה אינו תקין.',
  'Capacity must be a positive number': 'הקיבולת חייבת להיות מספר חיובי.',
  'Price per day must be a positive number': 'המחיר ליום חייב להיות מספר חיובי.',
  'Image URL is required': 'יש להזין כתובת תמונה.',
  'Description is required': 'יש להזין תיאור.',
  'Invalid equipment value': 'אחד מפריטי הציוד שנבחרו אינו תקין.',
  'Token is missing': 'יש להתחבר כדי לבצע פעולה זו.',
  'Token is invalid or expired': 'פג תוקף ההתחברות. יש להתחבר מחדש.',
  'Access denied': 'אין לך הרשאה לבצע פעולה זו.',
  'Workspace not found': 'חלל העבודה לא נמצא.',
};

export function mapAuthErrorMessage(message) {
  return AUTH_ERROR_MESSAGES[message] || 'משהו השתבש. נסו שוב בעוד רגע.';
}

export function isSessionErrorMessage(message) {
  return SESSION_ERROR_MESSAGES.includes(message);
}

export function mapReservationErrorMessage(message) {
  return RESERVATION_ERROR_MESSAGES[message] || 'משהו השתבש. נסו שוב בעוד רגע.';
}

export function mapBranchErrorMessage(message) {
  return BRANCH_ERROR_MESSAGES[message] || 'משהו השתבש. נסו שוב בעוד רגע.';
}

export function mapWorkspaceErrorMessage(message) {
  return WORKSPACE_ERROR_MESSAGES[message] || 'משהו השתבש. נסו שוב בעוד רגע.';
}
