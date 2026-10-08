/**
 * Lê o perfil de QUEM ESTÁ LOGADO.
 *
 * Existe por causa de uma armadilha que já tinha quebrado seis telas. A RLS
 * de `profiles` deixa o paciente ver também o perfil do nutricionista a quem
 * ele está vinculado — é assim que o nome do profissional aparece em "Meu
 * plano". Consequência: `from("profiles").select(...).maybeSingle()` SEM
 * filtro por id devolve duas linhas, e o `maybeSingle` falha com mais de uma.
 *
 * O resultado era silencioso e perverso: metas, sexo e data de nascimento
 * sumiam exatamente para quem TEM acompanhamento — o caso de uso principal
 * do produto. Com conta solta, sem vínculo, tudo funcionava.
 */
export async function meuPerfil<T = any>(
  supabase: any,
  colunas = "*"
): Promise<T | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select(colunas)
    .eq("id", user.id)
    .maybeSingle();
  return (data as T) ?? null;
}
