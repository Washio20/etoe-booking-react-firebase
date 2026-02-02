import { Reservation } from '@/types/reservation';

export const mergeUserProfile = (
  reservation: Reservation,
  userData:
    | {
        fullName?: string;
        phone?: string;
        gender?: string;
        birthdate?: string;
      }
    | undefined
) => {
  if (!userData) return reservation;
  return {
    ...reservation,
    userFullName: reservation.userFullName || userData.fullName,
    userPhone: reservation.userPhone || userData.phone,
    userGender: reservation.userGender || (userData.gender as Reservation['userGender']),
    userBirthdate: reservation.userBirthdate || userData.birthdate
  };
};
