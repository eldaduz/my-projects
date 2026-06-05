// Multiplier 1.18 = base price + 18% VAT.
// toFixed(2) + Number() prevents floating-point artifacts (e.g. 100.00000000001).
export const calculateReservationTotalPrice = ({ reservedDays, pricePerDayAtBooking }) => {
  const totalPrice = reservedDays * pricePerDayAtBooking * 1.18;
  return Number(totalPrice.toFixed(2));
};
