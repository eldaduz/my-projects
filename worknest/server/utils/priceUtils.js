export const calculateReservationTotalPrice = ({ reservedDays, pricePerDayAtBooking }) => {
  const totalPrice = reservedDays * pricePerDayAtBooking * 1.18;
  return Number(totalPrice.toFixed(2));
};
