import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { SignInScreen } from '../SignInScreen';

const mockMutate = jest.fn();
let mockMutationState: { isPending: boolean; isError: boolean; error: unknown } = {
  isPending: false,
  isError: false,
  error: null,
};

jest.mock('../api', () => ({
  useSendOtp: () => ({ mutate: mockMutate, ...mockMutationState }),
}));

describe('<SignInScreen />', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockMutationState = { isPending: false, isError: false, error: null };
  });

  it('asks for a number when empty', async () => {
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.press(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Enter a mobile number.')).toBeOnTheScreen();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('rejects a number that is not a Pakistani mobile', async () => {
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.type(screen.getByLabelText('Mobile number'), '042 35555555');
    await user.press(screen.getByRole('button', { name: 'Send code' }));
    expect(
      await screen.findByText('Enter a valid Pakistani mobile number, like 0300 1234567.'),
    ).toBeOnTheScreen();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('sends the code to the normalized E.164 number', async () => {
    const user = userEvent.setup();
    await render(<SignInScreen />);
    await user.type(screen.getByLabelText('Mobile number'), '0300 1234567');
    await user.press(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledWith('+923001234567', expect.any(Object)));
  });

  it('shows a friendly server error', async () => {
    mockMutationState = {
      isPending: false,
      isError: true,
      error: { code: 'over_sms_send_rate_limit', status: 429 },
    };
    await render(<SignInScreen />);
    expect(screen.getByText('Too many attempts. Please wait a minute and try again.')).toBeOnTheScreen();
  });

  it('shows a busy button while sending', async () => {
    mockMutationState = { isPending: true, isError: false, error: null };
    await render(<SignInScreen />);
    expect(screen.getByRole('button', { name: 'Send code' })).toBeBusy();
  });
});
