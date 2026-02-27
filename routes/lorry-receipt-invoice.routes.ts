import { Router } from "express";

import { isAuthenticated } from "../middleware";

import {
  createLorryReceiptInvoice,
  getDataFromLrIds,
  getLorryReceiptInvoice,
  getLorryReceiptInvoiceForPDF,
  listLorryReceiptInvoices,
  listUnpaidLorryReceiptInvoices,
} from "../controllers/lorryReceiptInvoice.controllers";

const router = Router();

router.get("/list", isAuthenticated, listLorryReceiptInvoices);

router.post("/lr-ids", isAuthenticated, getDataFromLrIds);

router.post("/create", isAuthenticated, createLorryReceiptInvoice);

router.get("/list-unpaid", isAuthenticated, listUnpaidLorryReceiptInvoices);

router.get("/get-invoice-details", isAuthenticated, getLorryReceiptInvoice);

router.get(
  "/get-invoice-details-for-pdf",
  isAuthenticated,
  getLorryReceiptInvoiceForPDF,
);

export default router;
