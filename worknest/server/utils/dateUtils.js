export const parseDateOnly = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(trimmedValue)) {
    return null;
  }

  const [year, month, day] = trimmedValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
};

export const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const getReservedDaysExclusive = (startDate, endDate) => {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
};

export const formatDateOnly = (dateValue) => {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};
