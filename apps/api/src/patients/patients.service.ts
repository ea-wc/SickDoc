import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ErrorCodes } from "@sickdoc/shared";
import { AppException } from "../common/exceptions/app.exception.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { UpdatePatientDto } from "./dto/update-patient.dto.js";

/** Patient profile self-service (docs/API_SPEC.md §4). */
@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new AppException(ErrorCodes.NOT_FOUND, "Patient profile not found");
    }
    return profile;
  }

  async updateMe(userId: string, dto: UpdatePatientDto) {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new AppException(ErrorCodes.NOT_FOUND, "Patient profile not found");
    }

    const data: Prisma.PatientProfileUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.birthDate !== undefined) data.birthDate = dto.birthDate ? new Date(`${dto.birthDate}T00:00:00.000Z`) : null;
    if (dto.sex !== undefined) data.sex = dto.sex || null;
    if (dto.weightKg !== undefined) data.weightKg = dto.weightKg;
    if (dto.heightCm !== undefined) data.heightCm = dto.heightCm;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.addressLine !== undefined) data.addressLine = dto.addressLine || null;
    if (dto.city !== undefined) data.city = dto.city || null;
    if (dto.country !== undefined) data.country = dto.country || null;
    if (dto.medicalHistory !== undefined) data.medicalHistory = dto.medicalHistory || null;
    if (dto.allergies !== undefined) data.allergies = dto.allergies;
    if (dto.conditions !== undefined) data.conditions = dto.conditions;

    return this.prisma.patientProfile.update({ where: { id: profile.id }, data });
  }
}
