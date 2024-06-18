// Utility function to check if a value is an Excel date serial number
export const isDateSerial = (value: any): boolean => {
  return typeof value === 'number' && value > 0 && value < 2958465; // Excel serial date range
};

// Utility function to convert Excel date serial number to JavaScript Date
export const excelDateToJSDate = (serial: number): Date => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);

  return new Date(
    dateInfo.getUTCFullYear(),
    dateInfo.getUTCMonth(),
    dateInfo.getUTCDate()
  );
};
