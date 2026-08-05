// Tipos do banco de dados Pace Fit.
// Gerados a partir do schema do Supabase (mantidos em sincronia com a migration).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      body_measurements: {
        Row: {
          arm_cm: number | null;
          calf_cm: number | null;
          neck_cm: number | null;
          body_fat_pct: number | null;
          chest_cm: number | null;
          created_at: string;
          date: string;
          hip_cm: number | null;
          id: string;
          notes: string | null;
          thigh_cm: number | null;
          user_id: string;
          waist_cm: number | null;
          weight_kg: number | null;
        };
        Insert: {
          arm_cm?: number | null;
          calf_cm?: number | null;
          neck_cm?: number | null;
          body_fat_pct?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          date?: string;
          hip_cm?: number | null;
          id?: string;
          notes?: string | null;
          thigh_cm?: number | null;
          user_id: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          arm_cm?: number | null;
          calf_cm?: number | null;
          neck_cm?: number | null;
          body_fat_pct?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          date?: string;
          hip_cm?: number | null;
          id?: string;
          notes?: string | null;
          thigh_cm?: number | null;
          user_id?: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      daily_logs: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          energy: number | null;
          mood: string | null;
          notes: string | null;
          pain: number | null;
          sleep_hours: number | null;
          steps: number | null;
          stress: number | null;
          user_id: string;
          water_ml: number | null;
        };
        Insert: {
          created_at?: string;
          date?: string;
          id?: string;
          energy?: number | null;
          mood?: string | null;
          notes?: string | null;
          pain?: number | null;
          sleep_hours?: number | null;
          steps?: number | null;
          stress?: number | null;
          user_id: string;
          water_ml?: number | null;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          energy?: number | null;
          mood?: string | null;
          notes?: string | null;
          pain?: number | null;
          sleep_hours?: number | null;
          steps?: number | null;
          stress?: number | null;
          user_id?: string;
          water_ml?: number | null;
        };
        Relationships: [];
      };
      exams: {
        Row: {
          created_at: string;
          date: string;
          exam_type: string | null;
          id: string;
          notes: string | null;
          reference_range: string | null;
          result_value: string | null;
          status: string | null;
          title: string;
          unit: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date?: string;
          exam_type?: string | null;
          id?: string;
          notes?: string | null;
          reference_range?: string | null;
          result_value?: string | null;
          status?: string | null;
          title: string;
          unit?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          exam_type?: string | null;
          id?: string;
          notes?: string | null;
          reference_range?: string | null;
          result_value?: string | null;
          status?: string | null;
          title?: string;
          unit?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          position: number | null;
          reps: number | null;
          rpe: number | null;
          sets: number | null;
          sets_json: Json | null;
          user_id: string;
          weight_kg: number | null;
          workout_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          position?: number | null;
          reps?: number | null;
          rpe?: number | null;
          sets?: number | null;
          sets_json?: Json | null;
          user_id: string;
          weight_kg?: number | null;
          workout_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          position?: number | null;
          reps?: number | null;
          rpe?: number | null;
          sets?: number | null;
          sets_json?: Json | null;
          user_id?: string;
          weight_kg?: number | null;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercises_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      meals: {
        Row: {
          calories: number | null;
          carbs_g: number | null;
          created_at: string;
          date: string;
          description: string;
          fat_g: number | null;
          id: string;
          meal_type: string;
          protein_g: number | null;
          user_id: string;
        };
        Insert: {
          calories?: number | null;
          carbs_g?: number | null;
          created_at?: string;
          date?: string;
          description: string;
          fat_g?: number | null;
          id?: string;
          meal_type?: string;
          protein_g?: number | null;
          user_id: string;
        };
        Update: {
          calories?: number | null;
          carbs_g?: number | null;
          created_at?: string;
          date?: string;
          description?: string;
          fat_g?: number | null;
          id?: string;
          meal_type?: string;
          protein_g?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          birth_date: string | null;
          cpf: string | null;
          created_at: string;
          daily_calorie_goal: number | null;
          daily_water_goal_ml: number | null;
          full_name: string | null;
          height_cm: number | null;
          id: string;
          updated_at: string;
          weight_goal_kg: number | null;
        };
        Insert: {
          birth_date?: string | null;
          cpf?: string | null;
          created_at?: string;
          daily_calorie_goal?: number | null;
          daily_water_goal_ml?: number | null;
          full_name?: string | null;
          height_cm?: number | null;
          id: string;
          updated_at?: string;
          weight_goal_kg?: number | null;
        };
        Update: {
          birth_date?: string | null;
          cpf?: string | null;
          created_at?: string;
          daily_calorie_goal?: number | null;
          daily_water_goal_ml?: number | null;
          full_name?: string | null;
          height_cm?: number | null;
          id?: string;
          updated_at?: string;
          weight_goal_kg?: number | null;
        };
        Relationships: [];
      };
      workouts: {
        Row: {
          category: string | null;
          created_at: string;
          date: string;
          duration_min: number | null;
          id: string;
          name: string;
          notes: string | null;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          date?: string;
          duration_min?: number | null;
          id?: string;
          name: string;
          notes?: string | null;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          date?: string;
          duration_min?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      workout_plan: {
        Row: {
          created_at: string;
          day_of_week: number;
          id: string;
          notes: string | null;
          position: number;
          sport: string;
          title: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: number;
          id?: string;
          notes?: string | null;
          position?: number;
          sport: string;
          title?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          id?: string;
          notes?: string | null;
          position?: number;
          sport?: string;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      plan_completions: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          plan_id: string;
          user_id: string;
          workout_id: string | null;
        };
        Insert: {
          created_at?: string;
          date?: string;
          id?: string;
          plan_id: string;
          user_id: string;
          workout_id?: string | null;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          plan_id?: string;
          user_id?: string;
          workout_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cpf_disponivel: {
        Args: { p_cpf: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

// Aliases de conveniência (linhas retornadas em selects)
export type Profile = PublicSchema["Tables"]["profiles"]["Row"];
export type Workout = PublicSchema["Tables"]["workouts"]["Row"];
export type Exercise = PublicSchema["Tables"]["exercises"]["Row"];
export type Meal = PublicSchema["Tables"]["meals"]["Row"];
export type BodyMeasurement = PublicSchema["Tables"]["body_measurements"]["Row"];
export type DailyLog = PublicSchema["Tables"]["daily_logs"]["Row"];
export type Exam = PublicSchema["Tables"]["exams"]["Row"];
export type WorkoutPlan = PublicSchema["Tables"]["workout_plan"]["Row"];
export type PlanCompletion = PublicSchema["Tables"]["plan_completions"]["Row"];
