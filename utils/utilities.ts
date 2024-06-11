export const getStartAndEnd = (d: string) => {
  const startDate = new Date(d);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
};
