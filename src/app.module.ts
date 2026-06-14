import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { TenantModule } from './tenant/tenant.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { StudentProfilesModule } from './student-profiles/student-profiles.module';
import { TeacherProfilesModule } from './teacher-profiles/teacher-profiles.module';
import { StudentPortfoliosModule } from './student-portfolios/student-portfolios.module';
import { StudentAchievementsModule } from './student-achievements/student-achievements.module';
import { RoomsModule } from './rooms/rooms.module';
import { ClassroomsModule } from './classrooms/classrooms.module';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { SchedulesModule } from './schedules/schedules.module';
import { TeacherUnavailabilityModule } from './teacher-unavailability/teacher-unavailability.module';
import { ContractsModule } from './contracts/contracts.module';
import { NetworksModule } from './networks/networks.module';
import { HomeroomAssignmentsModule } from './homeroom-assignments/homeroom-assignments.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AcademicNotesModule } from './academic-notes/academic-notes.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SuperadminModule } from './superadmin/superadmin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    RedisModule,
    MailModule,
    StorageModule,
    TenantModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    StudentProfilesModule,
    TeacherProfilesModule,
    StudentPortfoliosModule,
    StudentAchievementsModule,
    ClassroomsModule,
    AcademicYearsModule,
    RoomsModule,
    SchedulesModule,
    TeacherUnavailabilityModule,
    ContractsModule,
    NetworksModule,
    HomeroomAssignmentsModule,
    AnnouncementsModule,
    NotificationsModule,
    AcademicNotesModule,
    AdmissionsModule,
    AttendanceModule,
    SuperadminModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: '', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/platform/user', method: RequestMethod.POST },
        { path: 'auth/forgot-password', method: RequestMethod.POST },
        { path: 'auth/reset-password', method: RequestMethod.POST },
        { path: 'api/docs/(.*)', method: RequestMethod.GET },
        { path: 'tenants', method: RequestMethod.ALL },
        { path: 'tenants/(.*)', method: RequestMethod.ALL },
        { path: 'networks', method: RequestMethod.ALL },
        { path: 'networks/(.*)', method: RequestMethod.ALL },
        { path: 'superadmin', method: RequestMethod.ALL },
        { path: 'superadmin/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
