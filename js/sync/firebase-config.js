// Configuração do projeto Firebase usado para login e sincronização.
//
// Estes valores NÃO são senha nem segredo: o Firebase foi feito para eles ficarem no site
// (qualquer visitante consegue vê-los). Quem protege os dados são as regras de segurança do
// Firestore, que só deixam cada usuário logado ler e gravar os próprios dados.
//
// Enquanto estiver `null`, o app funciona normalmente só neste aparelho (sem login).
export const FIREBASE_CONFIG = null;
