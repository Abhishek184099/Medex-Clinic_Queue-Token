import { CheckInRepository } from "./check-in.repository";
import { prisma } from "../config/db";

export const checkInRepository = new CheckInRepository(prisma);
