export interface UserAccount {
  user_unique_identifier: number;
  user_full_display_name: string;
  user_email_address: string;
}

export interface UserAccountCreate {
  user_full_display_name: string;
  user_email_address: string;
  user_plain_text_password: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
