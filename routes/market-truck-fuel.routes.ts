import { Router } from "express";
import { isAuthenticated } from "../middleware";
import {
  createMarketTruckFuel,
  deleteMarketTruckFuel,
  getMarketTruckFuel,
  listMarketTruckFuel,
  updateMarketTruckFuel,
} from "../controllers/marketTruckFuel.controllers";

const router = Router();

router.get("/list", isAuthenticated, listMarketTruckFuel);
router.get("/", isAuthenticated, getMarketTruckFuel);
router.post("/create", isAuthenticated, createMarketTruckFuel);
router.put("/update/:marketTruckFuelId", isAuthenticated, updateMarketTruckFuel);
router.delete("/delete", isAuthenticated, deleteMarketTruckFuel);

export default router;
