import { checkInRepository } from "../repositories";
import { CheckInService } from "./check-in.service";

export const checkInService = new CheckInService(checkInRepository);
