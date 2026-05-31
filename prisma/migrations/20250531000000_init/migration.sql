-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "log_date" DATE NOT NULL,
    "weight_kg" DECIMAL(5,2),
    "steps" INTEGER,
    "calories_kcal" INTEGER,
    "fat_grams" INTEGER,
    "carbs_grams" INTEGER,
    "protein_grams" INTEGER,
    "garmin_calories_kcal" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_assessments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "week_start_date" DATE NOT NULL,
    "resting_pulse_bpm" INTEGER,
    "belly_cm" DECIMAL(5,2),
    "neck_cm" DECIMAL(5,2),
    "chest_cm" DECIMAL(5,2),
    "satiety_score" INTEGER,
    "calorie_tracking_score" INTEGER,
    "sleep_score" INTEGER,
    "wellbeing_score" INTEGER,
    "stress_score" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "daily_logs_user_id_log_date_idx" ON "daily_logs"("user_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_logs_user_id_log_date_key" ON "daily_logs"("user_id", "log_date");

-- CreateIndex
CREATE INDEX "weekly_assessments_user_id_week_number_idx" ON "weekly_assessments"("user_id", "week_number");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_assessments_user_id_week_start_date_key" ON "weekly_assessments"("user_id", "week_start_date");

-- AddForeignKey
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_assessments" ADD CONSTRAINT "weekly_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
