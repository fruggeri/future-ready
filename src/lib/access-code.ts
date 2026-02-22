const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateKidAccessCode(length = 6) {
    let code = "";
    for (let i = 0; i < length; i += 1) {
        const index = Math.floor(Math.random() * ACCESS_CODE_ALPHABET.length);
        code += ACCESS_CODE_ALPHABET[index];
    }
    return code;
}
