export type InputKind = "appointment" | "walk_in"
export type QueueKind = "emergency" | "appointment" | "walk_in";
export type TokenPrefix = "E" | "A" | "W"

export const TOKEN_PREFIX : Record<QueueKind , TokenPrefix> = {
    emergency : "E",
    appointment : "A",
    walk_in : "W"
}

export const LATE_GRACE_MS = 15 * 60 * 1000;

export interface CheckInInput{
    name : string;
    age : number;
    kind : InputKind;
    emergency : boolean
    appointmentTime : Date | null;
}

export interface CheckInRecord  {
  token: string;
  name: string;
  age: number;
  queueKind: QueueKind;
   appointmentTime: Date | null;
  checkedInAt: Date;
}

export interface  CheckInResult {
  token: string;
  name: string;
  queueKind: QueueKind;
  convertedToWalkIn: boolean;
  checkedInAt: string;
  appointmentTime: string | null;
}

export interface QueueDecision {
  queueKind: QueueKind;
  convertedToWalkIn: boolean;
}

// interface QueueDecisionInput {
//   kind: InputKind;
//   emergency: boolean;
//   appointmentTime: Date | null;
// }

export function resolveQueueKind(
    input : Pick<CheckInInput , "kind" | "emergency" | "appointmentTime">,
    now : Date,
) : QueueDecision{
  if(input.emergency){
    return {queueKind : "emergency" , convertedToWalkIn : false}
  }
  if (input.kind === "walk_in"){
    return { queueKind: "walk_in", convertedToWalkIn: false };
  }
  if(input.appointmentTime === null){
        throw new Error("Appointment check-in is missing its appointment time");
  }

  const minutesLate =  now.getTime() - input.appointmentTime.getTime();
  const isLate = minutesLate > LATE_GRACE_MS;

  return isLate ? {queueKind : "walk_in" , convertedToWalkIn: true}:
         {queueKind : "appointment" , convertedToWalkIn: false};
}


