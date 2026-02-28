import { Request, Response } from "express";

import { z } from "zod";
// import puppeteer from 'puppeteer';
// import { readFileSync } from 'fs';
// import hbs from 'handlebars';

import { Ledger, LorryReceipt, LorryReceiptInvoice } from "../models";
import { handleErrors, handleSuccess } from "../utils/response.utils";
import db from "../setups/mongo";
import {
  constructAmount,
  constructAmountToWords,
  constructBillingPartyAddress,
  constructCompanyAddress,
  constructDate,
  transformLrInvoiceData,
} from "../utils/utilities";

export const listLorryReceiptInvoices = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page = 0, limit = 10, search = "" }: any = req.query;

    const lorryReceiptInvoices = await LorryReceiptInvoice.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [{ invoiceNo: new RegExp(search, "i") }],
        }),
      },
      [],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      },
    ).populate("ledgerId", ["legalName"]);

    if (!lorryReceiptInvoices)
      throw new Error("Lorry receipt invoice not found");

    const lorryReceiptInvoicesCount = await LorryReceiptInvoice.find({
      createdBy: userId,
      ...(search && {
        $or: [{ invoiceNo: new RegExp(search, "i") }],
      }),
    }).countDocuments();

    handleSuccess(res, {
      message: "Lorry receipt invoices fetched successfully",
      data: {
        data: lorryReceiptInvoices,
        count: lorryReceiptInvoicesCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching lorry receipt invoices",
      error,
    });
  }
};

export const getDataFromLrIds = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      company: { prefix },
    } = res.locals.user;
    const { lorryReceiptIds } = req.body;

    // Find all the lorryReciepts in the lorryReceiptIds array also check if the invoiceStatus is PENDING

    const lorryReceipts = await LorryReceipt.find({
      _id: { $in: lorryReceiptIds },
      createdBy: userId,
      invoiceStatus: "PENDING",
    }).populate("organizationDetails", [
      "companyName",
      "gst",
      "pan",
      "address",
      "country",
      "state",
      "zipCode",
      "logo",
      "stamp",
      "bankDetails",
    ]);

    if (lorryReceipts.length !== lorryReceiptIds.length)
      throw new Error("Lorry receipt(s) not found");

    // Make a Invoice number based on the User Company Prefix/currentyear-nextYear/lenght of lorryReceiptInvoice + 1

    const invoiceCount = await LorryReceiptInvoice.countDocuments({
      createdBy: userId,
    });

    let invoiceNo = "";
    if (prefix) {
      invoiceNo = `${prefix}/INV/${new Date().getFullYear()}-${
        new Date().getFullYear() + 1
      }/${invoiceCount + 1}`;
    } else {
      invoiceNo = `INV/${new Date().getFullYear()}/${
        new Date().getFullYear() + 1
      }/${invoiceCount + 1}`;
    }

    // Check if in all the lorryReceipts billigParty is same or not and after that fetch the details of blijgParty
    // Extract billingParty from each object
    const billingParties = lorryReceipts.map((item) => {
      const newitem = item.toObject();

      return newitem.billingParty.toString();
    });

    // Check if all billingParty values are the same
    const allSameBillingParty = billingParties.every(
      (billingParty) => billingParty === billingParties[0],
    );

    if (!allSameBillingParty)
      throw new Error("All lorry receipts should have same billing party");

    // Fetch the details of billingParty
    const billingParty = await Ledger.findOne({
      _id: billingParties[0],
      createdBy: userId,
    });

    if (!billingParty) throw new Error("Billing party not found");

    // Calculate totalAmount from all of the lorryReceipt by adding rate, detentionAmount, advance, tollPlazaAmount, adaniFee
    // const totalAmount = lorryReceipts.reduce((acc, lorryReceipt) => {
    //   const receipt = lorryReceipt.toObject(); // Convert the document to a plain object

    //   const rate = parseFloat(receipt.rate?.toFixed(2) || '0');
    //   const detentionAmount = parseFloat(
    //     receipt.detentionAmount?.toFixed(2) || '0'
    //   );
    //   const advance = parseFloat(receipt.advance?.toFixed(2) || '0');
    //   const tollPlazaAmount = parseFloat(
    //     receipt.tollPlazaAmount?.toFixed(2) || '0'
    //   );
    //   const adaniFee = parseFloat(receipt.adaniFee?.toFixed(2) || '0');

    //   const totalAmount =
    //     rate + detentionAmount + advance + tollPlazaAmount + adaniFee;

    //   return acc + totalAmount;
    // }, 0);

    handleSuccess(res, {
      message: "Lorry receipt fetched successfully",
      data: { data: lorryReceipts, invoiceNo, billingParty },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching lorry receipt data",
      error,
    });
  }
};

export const createLorryReceiptInvoice = async (
  req: Request,
  res: Response,
) => {
  const lorryReceiptInvoiceValidator = z.object({
    invoiceNo: z.string(),
    ledgerId: z.string(),
    invoiceDate: z.string(),
    dueDate: z.string(),
    lorryReceiptIds: z.array(z.string()),
    ownOrganization: z.boolean(),
    organizationDetails: z.string().optional(),
    gstApplicable: z.boolean(),
    gstPercentage: z.number().optional(),
    gstType: z.enum(["SGST-CGST", "IGST"]).optional(),
    gstAmount: z.number().optional(),
    subTotal: z.number(),
    totalAmount: z.number(),
    remarks: z.string().optional(),
  });

  // Initiate transaction
  const session = await db.startSession();

  // Start transaction
  session.startTransaction();

  try {
    lorryReceiptInvoiceValidator.parse(req.body);

    const { userId } = res.locals.user;

    const lorryReceiptInvoicePayload = req.body;

    // Check if the same invoiceNo already exists
    const existingInvoice = await LorryReceiptInvoice.findOne({
      invoiceNo: lorryReceiptInvoicePayload.invoiceNo,
      createdBy: userId,
    });

    if (existingInvoice) {
      throw new Error("Invoice No already exists");
    }

    const lorryReceiptInvoice = new LorryReceiptInvoice({
      ...lorryReceiptInvoicePayload,
      createdBy: userId,
    });

    const newLorryReceiptInvoice = await lorryReceiptInvoice.save({
      session: session,
    });

    if (!newLorryReceiptInvoice)
      throw new Error("Lorry receipt invoice not created");

    // Update the totalAmount & pendingAmount in the Ledger document
    const ledger = await Ledger.findOneAndUpdate(
      {
        _id: lorryReceiptInvoicePayload.ledgerId,
        createdBy: userId,
      },
      {
        $inc: {
          totalAmount: lorryReceiptInvoicePayload.totalAmount,
          pendingAmount: lorryReceiptInvoicePayload.totalAmount,
        },
      },
      {
        session: session,
      },
    );

    if (!ledger) throw new Error("Ledger not found");

    // Update all the ledgers in the LorryReceipt to be GENERATED in invoiceStatus

    const lorryReceipts = await LorryReceipt.find(
      {
        _id: { $in: lorryReceiptInvoicePayload.lorryReceiptIds },
        createdBy: userId,
      },
      [],
      { session: session },
    );

    if (!lorryReceipts) throw new Error("Lorry receipt not found");

    for (const lorryReceipt of lorryReceipts) {
      lorryReceipt.invoiceStatus = "GENERATED";
      await lorryReceipt.save({ session: session });
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: "Lorry receipt invoice created successfully",
      data: newLorryReceiptInvoice,
    });
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();
    session.endSession();

    handleErrors(req, res, {
      message: "Error while creating lorry receipt invoice",
      error,
    });
  }
};

export const listUnpaidLorryReceiptInvoices = async (
  req: Request,
  res: Response,
) => {
  try {
    const { userId } = res.locals.user;

    const lorryReceiptInvoices = await LorryReceiptInvoice.find({
      paymentStatus: "UNPAID",
      createdBy: userId,
    });

    if (!lorryReceiptInvoices)
      throw new Error("Lorry receipt invoices not found");

    const newLorryReceiptInvoices = lorryReceiptInvoices.map(
      (lorryReceiptInvoice) => ({
        value: lorryReceiptInvoice._id.toString(),
        label: lorryReceiptInvoice.invoiceNo,
      }),
    );

    handleSuccess(res, {
      message: "Lorry receipt invoices fetched successfully",
      data: newLorryReceiptInvoices,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching lorry receipt invoices",
      error,
    });
  }
};

export const getLorryReceiptInvoice = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { lorryReceiptInvoiceId } = req.query;

    const lorryReceiptInvoice = await LorryReceiptInvoice.findOne({
      _id: lorryReceiptInvoiceId,
      createdBy: userId,
    })
      .populate("ledgerId")
      .populate("lorryReceiptIds");

    if (!lorryReceiptInvoice)
      throw new Error("Lorry receipt invoice not found");

    handleSuccess(res, {
      message: "Lorry receipt invoice fetched successfully",
      data: lorryReceiptInvoice,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching lorry receipt invoice",
      error,
    });
  }
};

export const getLorryReceiptInvoiceForPDF = async (
  req: Request,
  res: Response,
) => {
  try {
    const { userId, company, bankDetails } = res.locals.user;
    const { lorryReceiptInvoiceId } = req.query;

    const lorryReceiptInvoice = await LorryReceiptInvoice.findOne({
      _id: lorryReceiptInvoiceId,
      createdBy: userId,
    })
      .populate("ledgerId")
      .populate("organizationDetails");

    if (!lorryReceiptInvoice)
      throw new Error("Lorry receipt invoice not found");

    const lorryReceipts = await LorryReceipt.find({
      _id: { $in: lorryReceiptInvoice?.lorryReceiptIds },
      createdBy: userId,
    }).populate("organizationDetails", [
      "companyName",
      "gst",
      "pan",
      "address",
      "country",
      "state",
      "zipCode",
      "logo",
      "stamp",
      "bankDetails",
    ]);

    if (lorryReceipts.length !== lorryReceiptInvoice?.lorryReceiptIds?.length)
      throw new Error("Lorry receipt(s) not found");

    const transformedLrData = transformLrInvoiceData(lorryReceipts);

    if (!transformedLrData) throw new Error("Lorry receipt(s) not found");

    const newTransformedData = transformedLrData?.map(
      (data: any, index: number) => {
        return {
          srNo: `${index + 1}`,
          description: data?.description,
          containerSize: `${data?.containerSize}`,
          rate: `${constructAmount(data?.rate)}`,
          totalItems: `${data?.totalItems}`,
          amount: `${constructAmount(data?.totalAmount)}`,
        };
      },
    );

    const companyName = lorryReceiptInvoice?.ownOrganization
      ? company?.name
      : (lorryReceiptInvoice?.organizationDetails as any)?.companyName;

    const address = lorryReceiptInvoice?.ownOrganization
      ? constructCompanyAddress(company)
      : constructCompanyAddress(lorryReceiptInvoice?.organizationDetails);

    const billingPartyName = (lorryReceiptInvoice?.ledgerId as any)?.legalName;

    const billinPartyAddress = constructBillingPartyAddress(
      (lorryReceiptInvoice?.ledgerId as any)?.address,
    );

    const billingPartyPan = (lorryReceiptInvoice?.ledgerId as any)?.pan;
    const billingPartyGstin = (lorryReceiptInvoice?.ledgerId as any)?.gstin;
    const invoiceNo = lorryReceiptInvoice?.invoiceNo;
    const invoiceDate = constructDate(lorryReceiptInvoice?.invoiceDate);
    const dueDate = constructDate(lorryReceiptInvoice?.dueDate);
    const subTotal = constructAmount(lorryReceiptInvoice?.subTotal);
    const isGstApplicable = lorryReceiptInvoice?.gstApplicable;
    const gstType = lorryReceiptInvoice?.gstType;
    const igstAmount = constructAmount(lorryReceiptInvoice?.gstAmount);
    const cgstAmount = constructAmount(lorryReceiptInvoice?.gstAmount / 2);
    const sgstAmount = constructAmount(lorryReceiptInvoice?.gstAmount / 2);
    const gstAmount = constructAmount(lorryReceiptInvoice?.gstAmount);
    const totalAmount = constructAmount(lorryReceiptInvoice?.totalAmount);
    const amountInWords = constructAmountToWords(
      lorryReceiptInvoice?.totalAmount,
    );
    const companyPan = company?.pan;
    const companyGstin = company?.gst;
    const companyBankAccHolderName = lorryReceiptInvoice?.ownOrganization
      ? bankDetails?.accountHolderName
      : (lorryReceiptInvoice?.organizationDetails as any)?.bankDetails
          ?.accountHolderName;
    const companyBankAccNumber = lorryReceiptInvoice?.ownOrganization
      ? bankDetails?.accountNumber
      : (lorryReceiptInvoice?.organizationDetails as any)?.bankDetails
          ?.accountNumber;
    const companyBankName = lorryReceiptInvoice?.ownOrganization
      ? bankDetails?.bankName
      : (lorryReceiptInvoice?.organizationDetails as any)?.bankDetails
          ?.bankName;
    const companyIfscCode = lorryReceiptInvoice?.ownOrganization
      ? bankDetails?.ifscCode
      : (lorryReceiptInvoice?.organizationDetails as any)?.bankDetails
          ?.ifscCode;
    const companyBranch = lorryReceiptInvoice?.ownOrganization
      ? bankDetails?.branch
      : (lorryReceiptInvoice?.organizationDetails as any)?.bankDetails?.branch;
    const logo = lorryReceiptInvoice?.ownOrganization
      ? company?.logo
      : (lorryReceiptInvoice?.organizationDetails as any)?.logo;
    const stamp = lorryReceiptInvoice?.ownOrganization
      ? company?.stamp
      : (lorryReceiptInvoice?.organizationDetails as any)?.stamp;

    const payloadData = {
      companyName: companyName || "",
      address: address || "",
      billingPartyName: billingPartyName || "",
      billinPartyAddress: billinPartyAddress || "",
      billingPartyPan: billingPartyPan || "N/A",
      billingPartyGstin: billingPartyGstin || "N/A",
      invoiceNo: invoiceNo || "",
      invoiceDate: invoiceDate || "",
      dueDate: dueDate || "",
      subTotal: subTotal || "",
      isGstApplicable: isGstApplicable,
      gstType: gstType || "",
      isSgstCgst: gstType === "SGST-CGST" ? true : false,
      igstAmount: igstAmount || 0,
      cgstAmount: cgstAmount || 0,
      sgstAmount: sgstAmount || 0,
      gstAmount: gstAmount || 0,
      totalAmount: totalAmount || "",
      amountInWords: amountInWords || "",
      companyPan: companyPan || "",
      companyGstin: companyGstin || "",
      companyBankAccHolderName: companyBankAccHolderName || "",
      companyBankAccNumber: companyBankAccNumber || "",
      companyBankName: companyBankName || "",
      companyIfscCode: companyIfscCode || "",
      companyBranch: companyBranch || "",
      logo: logo || "",
      stamp: stamp || "",
      content: newTransformedData || [],
    };

    console.log(
      "🚀 ~ getLorryReceiptInvoiceForPDF ~ payloadData:",
      payloadData,
    );

    handleSuccess(res, {
      message: "Lorry receipt invoice fetched successfully",
      data: payloadData,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching lorry receipt invoice for PDF",
      error,
    });
  }
};

export const getLorryReceiptAnnexureForPDF = async (
  req: Request,
  res: Response,
) => {
  try {
    const { userId, company } = res.locals.user;
    const { invoiceId } = req.query;

    if (!invoiceId) throw new Error("Invoice ID is required");

    // Find LorryReceiptInvoice by invoiceId
    const lorryReceiptInvoice = await LorryReceiptInvoice.findOne(
      {
        _id: invoiceId,
        createdBy: userId,
      },
      ["lorryReceiptIds", "ownOrganization", "organizationDetails"],
    ).populate("organizationDetails", [
      "companyName",
      "address",
      "state",
      "zipCode",
      "country",
      "logo",
      "stamp",
    ]);

    const lorryReceipts = await LorryReceipt.find(
      {
        _id: { $in: lorryReceiptInvoice?.lorryReceiptIds },
        createdBy: userId,
      },
      [
        "date",
        "containerNo",
        "containerSize",
        "ownVehicle",
        "vehicleId",
        "marketTruckDetails",
        "from",
        "to",
        "rate",
        "detentionAmount",
        "bookingNo",
        "containerStatus",
        "lorryReceiptId",
        "modeOfTrade",
      ],
    ).populate("vehicleId", ["registration.plateNumber"]);

    if (!lorryReceipts) throw new Error("Lorry receipt(s) not found");

    const newLorryReceipts = lorryReceipts.map((lorryReceipt, index) => {
      const srNo = `${index + 1}`;
      const lrDate = constructDate(lorryReceipt.date);
      const containerNo = lorryReceipt.containerNo;
      const containerSize = lorryReceipt.containerSize;
      const vehicleNo = lorryReceipt.ownVehicle
        ? (lorryReceipt.vehicleId as any)?.registration.plateNumber
        : lorryReceipt?.marketTruckDetails?.vehiclePlateNumber;
      const from = lorryReceipt.from;
      const to = lorryReceipt.to;
      const rate = constructAmount(lorryReceipt.rate || 0);
      const detentionAmount = constructAmount(
        lorryReceipt.detentionAmount || 0,
      );
      const total = constructAmount(
        (lorryReceipt.rate || 0) + (lorryReceipt.detentionAmount || 0),
      );
      const bookingNo = lorryReceipt.bookingNo;
      const containerStatus = lorryReceipt.containerStatus
        ? lorryReceipt.containerStatus
        : lorryReceipt.modeOfTrade === "EMPTY"
          ? "EMPTY"
          : "LOADED";
      const lorryReceiptId = lorryReceipt.lorryReceiptId;
      const modeOfTrade = lorryReceipt.modeOfTrade;
      const remarks = lorryReceipt.remarks;
      const ownOrganization = lorryReceipt.ownOrganization;
      const organizationDetails = lorryReceipt.organizationDetails;
      const createdBy = lorryReceipt.createdBy;
      const createdAt = lorryReceipt.createdAt;

      return {
        srNo: srNo || "",
        lrDate: lrDate || "",
        containerNo: containerNo || "",
        containerSize: containerSize || "",
        vehicleNo: vehicleNo || "",
        from: from || "",
        to: to || "",
        rate: rate || "",
        detentionAmount: detentionAmount || "",
        total: total || "",
        bookingNo: bookingNo || "-",
        containerStatus: containerStatus || "-",
        lorryReceiptId: lorryReceiptId || "",
      };
    });

    const companyName = lorryReceiptInvoice?.ownOrganization
      ? company.name
      : (lorryReceiptInvoice?.organizationDetails as any)?.companyName;

    const address = lorryReceiptInvoice?.ownOrganization
      ? constructCompanyAddress(company)
      : constructCompanyAddress(lorryReceiptInvoice?.organizationDetails);

    const logo = lorryReceiptInvoice?.ownOrganization
      ? company?.logo
      : (lorryReceiptInvoice?.organizationDetails as any)?.logo;

    const totalRateAmount =
      lorryReceipts
        .map((lr) => lr.rate)
        .reduce((a, b) => (a || 0) + (b || 0), 0) || 0;

    const totalDetentionAmount =
      lorryReceipts
        .map((lr) => lr.detentionAmount)
        .reduce((a, b) => (a || 0) + (b || 0), 0) || 0;

    const totalAmountOfLorryReceipts =
      lorryReceipts
        .map((lr) => (lr.rate || 0) + (lr.detentionAmount || 0))
        .reduce((a, b) => (a || 0) + (b || 0), 0) || 0;

    const payloadData = {
      companyName: companyName || "",
      address: address || "",
      logo: logo || "",
      content: newLorryReceipts,
      totalRateAmount: constructAmount(totalRateAmount) || "0",
      totalDetentionAmount: constructAmount(totalDetentionAmount) || "0",
      totalAmountOfLorryReceipts:
        constructAmount(totalAmountOfLorryReceipts) || "0",
    };

    handleSuccess(res, {
      message: "Lorry receipt annexure fetched successfully",
      data: payloadData,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching lorry receipt annexure for PDF",
      error,
    });
  }
};
