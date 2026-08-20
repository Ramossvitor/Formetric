import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(12, 'Use pelo menos 12 caracteres.')
  .max(128, 'Use no máximo 128 caracteres.')

export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

export const inviteSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Informe pelo menos 2 caracteres.')
      .max(100, 'Use no máximo 100 caracteres.'),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'As senhas precisam ser iguais.',
    path: ['passwordConfirmation'],
  })

export const createInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe o e-mail da pessoa convidada.')
    .max(320, 'Use no máximo 320 caracteres.')
    .regex(/^[^\s@]+@[^\s@]+$/, 'Informe um e-mail válido.'),
  role: z.enum(['OWNER', 'USER'], { error: 'Selecione um nível de acesso válido.' }),
  expiresInHours: z
    .number({ error: 'Informe a validade do convite em horas.' })
    .int('A validade deve ser informada em horas inteiras.')
    .min(1, 'A validade mínima é de 1 hora.')
    .max(720, 'A validade máxima é de 720 horas.'),
})

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Informe pelo menos 2 caracteres.')
    .max(100, 'Use no máximo 100 caracteres.'),
  locale: z
    .string()
    .trim()
    .min(2, 'Informe o idioma.')
    .max(35, 'Use no máximo 35 caracteres.'),
  timeZone: z
    .string()
    .trim()
    .min(1, 'Informe o fuso horário.')
    .max(63, 'Use no máximo 63 caracteres.'),
  unitSystem: z.enum(['METRIC', 'IMPERIAL']),
  birthDate: z.string(),
  formulaSex: z.enum(['', 'MALE', 'FEMALE']),
})

export type LoginFormValues = z.infer<typeof loginSchema>
export type InviteFormValues = z.infer<typeof inviteSchema>
export type CreateInviteFormValues = z.infer<typeof createInviteSchema>
export type ProfileFormValues = z.infer<typeof profileSchema>
