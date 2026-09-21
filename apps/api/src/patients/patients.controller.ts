import { Body, Controller, Get, Patch } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { AuthenticatedUser } from "../common/auth.types.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { UpdatePatientDto } from "./dto/update-patient.dto.js";
import { PatientsService } from "./patients.service.js";

/** Patient profile self-service (docs/API_SPEC.md §4). */
@Controller("patients")
@Roles(Role.PATIENT)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get("me")
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.getMe(user.id);
  }

  @Patch("me")
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePatientDto) {
    return this.patientsService.updateMe(user.id, dto);
  }
}
