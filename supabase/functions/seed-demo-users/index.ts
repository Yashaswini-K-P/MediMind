import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const demoUsers = [
      {
        email: "patient@medimind.com",
        password: "MediMind123!",
        role: "patient",
        fullName: "Ananya Sharma",
        profile: {
          patient_code: "MM-1024",
          date_of_birth: "1980-03-15",
          sex: "Female",
          blood_group: "B+",
          phone: "+91 98765 43210",
          allergies: "None recorded",
          drug_allergies: "None recorded",
          food_allergies: "None recorded",
          medical_conditions: "Hypertension; Type 2 Diabetes",
          medical_history: "Diagnosed with T2DM in 2018. Hypertension managed since 2019.",
          height: 158,
          weight: 62,
          emergency_contact: "Rahul Sharma +91 98765 11111",
        },
      },
      {
        email: "professional@medimind.com",
        password: "MediMind123!",
        role: "professional",
        fullName: "Dr. Rajesh Kumar",
        profile: {
          license_number: "KMC-78942",
          professional_type: "Physician",
          specialty: "Internal Medicine",
          organization: "MediMind Clinic",
          phone: "+91 99876 54321",
        },
      },
    ];

    const results: Array<{ email: string; status: string; userId?: string; error?: string }> = [];

    for (const demo of demoUsers) {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email === demo.email);

      if (existing) {
        results.push({ email: demo.email, status: "already_exists", userId: existing.id });
        continue;
      }

      // Create the auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: demo.email,
        password: demo.password,
        email_confirm: true,
        user_metadata: { full_name: demo.fullName, role: demo.role },
      });

      if (authError) {
        results.push({ email: demo.email, status: "error", error: authError.message });
        continue;
      }

      const userId = authData.user.id;

      // Insert profile record
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email: demo.email,
        role: demo.role,
        is_active: true,
        last_login_at: new Date().toISOString(),
      });

      if (profileError) {
        results.push({ email: demo.email, status: "profile_error", error: profileError.message });
        continue;
      }

      if (demo.role === "patient") {
        const { error: ppError } = await supabase.from("patient_profiles").insert({
          user_id: userId,
          full_name: demo.fullName,
          ...demo.profile,
        });
        if (ppError) {
          results.push({ email: demo.email, status: "patient_profile_error", error: ppError.message });
          continue;
        }

        // Create default settings
        await supabase.from("patient_settings").insert({ user_id: userId });
      } else if (demo.role === "professional") {
        const { error: profError } = await supabase.from("professional_profiles").insert({
          user_id: userId,
          full_name: demo.fullName,
          ...demo.profile,
        });
        if (profError) {
          results.push({ email: demo.email, status: "prof_profile_error", error: profError.message });
          continue;
        }
      }

      results.push({ email: demo.email, status: "created", userId });
    }

    // Create assignment: patient -> professional
    const patientResult = results.find((r) => r.email === "patient@medimind.com");
    const profResult = results.find((r) => r.email === "professional@medimind.com");

    if (patientResult?.userId && profResult?.userId) {
      // Get patient_profiles id for the patient user
      const { data: pp } = await supabase
        .from("patient_profiles")
        .select("id")
        .eq("user_id", patientResult.userId)
        .single();

      if (pp) {
        // Check if assignment already exists
        const { data: existingAsgn } = await supabase
          .from("assignments")
          .select("id")
          .eq("patient_id", pp.id)
          .eq("professional_id", profResult.userId)
          .single();

        if (!existingAsgn) {
          await supabase.from("assignments").insert({
            patient_id: pp.id,
            professional_id: profResult.userId,
            status: "active",
          });
        }
      }
    }

    // Seed demo medication schedule and dose records for the patient
    if (patientResult?.userId) {
      const { data: pp } = await supabase
        .from("patient_profiles")
        .select("id")
        .eq("user_id", patientResult.userId)
        .single();

      if (pp) {
        // Get medications
        const { data: meds } = await supabase.from("medications").select("id, generic_name");

        if (meds && meds.length > 0) {
          const getMed = (name: string) => meds.find((m) => m.generic_name === name);

          // Create a prescription
          const { data: rx } = await supabase
            .from("prescriptions")
            .insert({
              patient_id: pp.id,
              source: "manual",
              status: "active",
              prescription_date: "2026-08-01",
              start_date: "2026-08-01",
              notes: "Demo prescription for testing",
            })
            .select()
            .single();

          if (rx) {
            const medLines = [
              { med: getMed("metformin"), dose: "500", doseUnit: "mg", frequency: "Twice daily", food: "With meals", time: "08:00", instructions: "Take with morning meal" },
              { med: getMed("metformin"), dose: "500", doseUnit: "mg", frequency: "Twice daily", food: "With meals", time: "20:00", instructions: "Take with evening meal" },
              { med: getMed("amlodipine"), dose: "5", doseUnit: "mg", frequency: "Once daily", food: "With or without food", time: "08:00", instructions: "Take at approximately the same time each day" },
              { med: getMed("warfarin"), dose: "5", doseUnit: "mg", frequency: "Once daily", food: "Consistent vitamin K intake", time: "20:00", instructions: "Maintain consistent vitamin-K intake" },
            ];

            for (const line of medLines) {
              if (!line.med) continue;
              const { data: pl } = await supabase
                .from("prescription_lines")
                .insert({
                  prescription_id: rx.id,
                  medication_id: line.med.id,
                  medication_name: line.med.generic_name,
                  dose: line.dose,
                  dose_unit: line.doseUnit,
                  frequency: line.frequency,
                  instructions: line.instructions,
                  administration_with_food: line.food,
                  start_date: "2026-08-01",
                })
                .select()
                .single();

              // Create medication schedule
              const { data: sched } = await supabase
                .from("medication_schedules")
                .insert({
                  patient_id: pp.id,
                  prescription_id: rx.id,
                  prescription_line_id: pl?.id,
                  medication_id: line.med.id,
                  medication_name: line.med.generic_name,
                  dose: line.dose,
                  dose_unit: line.doseUnit,
                  scheduled_time: line.time,
                  frequency: line.frequency,
                  food_instruction: line.food,
                  administration_instruction: line.instructions,
                  active: true,
                  start_date: "2026-08-01",
                })
                .select()
                .single();

              // Create dose records for the first 24 days of August
              if (sched) {
                const statuses = ["taken", "taken", "taken", "missed", "taken", "taken", "late"];
                const doseRecords: Array<{
                  patient_id: string;
                  schedule_id: string;
                  medication_name: string;
                  dose: string;
                  scheduled_at: string;
                  taken_at: string | null;
                  status: string;
                }> = [];
                for (let day = 1; day <= 24; day++) {
                  const status = statuses[(day + line.med.generic_name.length) % statuses.length];
                  const scheduledDate = new Date(2026, 7, day, parseInt(line.time.slice(0, 2)), parseInt(line.time.slice(3, 5)));
                  const takenDate = status !== "scheduled" ? new Date(scheduledDate.getTime() + (status === "late" ? 90 : 5) * 60000) : null;
                  doseRecords.push({
                    patient_id: pp.id,
                    schedule_id: sched.id,
                    medication_name: line.med.generic_name,
                    dose: `${line.dose} ${line.doseUnit}`,
                    scheduled_at: scheduledDate.toISOString(),
                    taken_at: takenDate?.toISOString() || null,
                    status,
                  });
                }
                // Insert in batches
                for (let i = 0; i < doseRecords.length; i += 10) {
                  await supabase.from("dose_records").insert(doseRecords.slice(i, i + 10));
                }
              }
            }
          }

          // Seed some food intakes
          const { data: spinach } = await supabase.from("foods").select("id").eq("canonical_name", "spinach").single();
          const { data: grapefruit } = await supabase.from("foods").select("id").eq("canonical_name", "grapefruit").single();

          const foodIntakes = [
            { food: spinach, name: "Spinach curry + rice", time: "13:15", meal: "Afternoon", date: 24, components: ["Vitamin K"] },
            { food: grapefruit, name: "Grapefruit", time: "08:30", meal: "Morning", date: 21, components: ["furanocoumarins"] },
            { food: null, name: "Idli + sambar", time: "08:30", meal: "Morning", date: 24, components: [] },
            { food: null, name: "Green tea", time: "18:30", meal: "Evening", date: 23, components: [] },
          ];

          for (const fi of foodIntakes) {
            const consumedAt = new Date(2026, 7, fi.date, parseInt(fi.time.slice(0, 2)), parseInt(fi.time.slice(3, 5)));
            await supabase.from("food_intakes").insert({
              patient_id: pp.id,
              food_id: fi.food?.id || null,
              food_name: fi.name,
              components: fi.components,
              meal_period: fi.meal,
              consumed_at: consumedAt.toISOString(),
            });
          }

          // Seed safety reports
          const safetyReports = [
            {
              report_code: "SR-2408-01",
              symptom: "Nausea",
              severity: "Mild",
              medication_exposure: "Metformin 500 mg at 08:00",
              food_exposure: "Idli + sambar at 08:30",
              duration: "45 minutes",
              repeated: false,
              description: "Mild nausea after the morning dose.",
              status: "Needs review",
              reported_at: new Date(2026, 7, 24, 9, 15).toISOString(),
            },
            {
              report_code: "SR-2408-02",
              symptom: "Dizziness",
              severity: "Moderate",
              medication_exposure: "Amlodipine 5 mg at 08:00",
              food_exposure: "None recorded",
              duration: "20 minutes",
              repeated: true,
              description: "Similar dizziness reported on two previous days.",
              status: "Under review",
              reported_at: new Date(2026, 7, 23, 20, 40).toISOString(),
            },
          ];

          for (const sr of safetyReports) {
            await supabase.from("safety_reports").insert({
              patient_id: pp.id,
              ...sr,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
