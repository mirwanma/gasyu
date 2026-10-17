import type { Database } from "./database.types";

// database.types.ts dibuat otomatis dari Supabase (jangan diedit manual):
//   npx supabase gen types typescript --linked > lib/supabase/database.types.ts
//
// Generator menganggap argumen fungsi database tidak pernah null, padahal
// banyak fungsi kita sengaja menerima null (mis. set_my_avatar(null) = hapus
// foto, change_home_village(null) = Luar Cimahi). Tipe di bawah ini sama dengan
// Database, hanya argumen fungsinya dibuat boleh null.

type Fns = Database["public"]["Functions"];

type NullableArgs<F> = F extends { Args: infer A; Returns: infer R }
  ? Omit<F, "Args" | "Returns"> & {
      Args: [A] extends [never] ? A : { [K in keyof A]: A[K] | null };
      Returns: R;
    }
  : F;

export type AppDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: { [K in keyof Fns]: NullableArgs<Fns[K]> };
  };
};

export type { Json, Enums, Tables } from "./database.types";
