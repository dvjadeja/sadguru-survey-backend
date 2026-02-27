const { ToWords } = require("to-words");

export const getStartAndEnd = (d: string) => {
  const startDate = new Date(d);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
};

const toWords = new ToWords({
  localeCode: "en-IN",
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: false,
    currencyOptions: {
      // can be used to override defaults for the selected locale
      name: "Rupee",
      plural: "Rupees",
      symbol: "₹",
      fractionalUnit: {
        name: "Paisa",
        plural: "Paise",
        symbol: "",
      },
    },
  },
});

export const constructAmountToWords = (amount: number) => {
  if (!amount) return "";
  return toWords.convert(amount);
};

export const constructCompanyAddress = (company: any) => {
  return `${company?.address}, ${company?.state}, ${company?.country}: ${company?.zipCode}`;
};

export const constructBillingPartyAddress = (billingParty: any) => {
  return `${billingParty?.address || ""}, ${billingParty?.city || ""}, ${
    billingParty?.district || ""
  }, ${billingParty?.state || ""}: ${billingParty?.pincode}`;
};

export const constructDate = (date: string | Date) => {
  const newDate = new Date(date);
  const day = newDate.getDate();
  const month = newDate.getMonth() + 1;
  const year = newDate.getFullYear();
  return `${day}/${month}/${year}`;
};

// Function to remove whitespaces and convert to lower case
export function normalizeString(str: string) {
  return str.replace(/\s+/g, "").toLowerCase();
}

// Function to group data
export const transformLrInvoiceData = (data: any) => {
  const resultMap: any = {};
  const detentionMap: any = {};

  data.forEach((entry: any) => {
    const containerSize = normalizeString(entry.containerSize);
    const from = normalizeString(entry.from);
    const to = normalizeString(entry.to);
    const description = `${from} to ${to}`;
    const key = `${description}-${containerSize}-${entry.rate}`;

    if (resultMap[key]) {
      resultMap[key].totalAmount += entry.rate;
      resultMap[key].totalItems += 1;
    } else {
      resultMap[key] = {
        description: `${entry.from} to ${entry.to}`,
        containerSize: entry.containerSize,
        rate: entry.rate,
        totalAmount: entry.rate,
        totalItems: 1,
      };
    }

    if (entry.detentionAmount > 0) {
      const detentionKey = `DETENTION-${entry.containerSize}`;
      if (detentionMap[detentionKey]) {
        detentionMap[detentionKey].totalAmount += entry.detentionAmount;
        detentionMap[detentionKey].totalItems += 1;
      } else {
        detentionMap[detentionKey] = {
          description: `${entry.from} to ${entry.to} (DETENTION)`,
          containerSize: entry.containerSize,
          rate: entry.detentionAmount,
          totalAmount: entry.detentionAmount,
          totalItems: 1,
        };
      }
    }
  });

  const resultArray = Object.values(resultMap);
  const detentionArray = Object.values(detentionMap);

  return resultArray.concat(detentionArray);
};

export const constructAmount = (data: number | string) => {
  if (!data) return "";

  if (isNaN(Number(data))) {
    return "N/A";
  } else {
    return parseFloat(Number(data).toString()).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
};
