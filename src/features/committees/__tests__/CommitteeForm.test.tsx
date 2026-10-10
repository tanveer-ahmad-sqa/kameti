import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native';

import type { CommitteeFormInput } from '@shared/schemas/committee';

import { CommitteeForm } from '../CommitteeForm';

const defaults: CommitteeFormInput = {
  name: '',
  description: '',
  contributionAmount: '',
  memberCount: '',
  startMonth: '2030-01-01',
  dueDay: 5,
  payoutOffsetDays: 5,
  payoutOrderMethod: 'random',
  includeOrganizer: true,
};

async function renderForm(onSubmit = jest.fn(), defaultValues = defaults) {
  await render(
    <CommitteeForm
      mode="create"
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitting={false}
      submitError={null}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('<CommitteeForm />', () => {
  it('shows the total pot live while typing', async () => {
    const { user } = await renderForm();
    expect(screen.queryByTestId('committee-pot')).not.toBeOnTheScreen();

    await user.type(screen.getByLabelText('Monthly amount per member'), '10000');
    await user.type(screen.getByLabelText('Number of members'), '12');

    const pot = screen.getByTestId('committee-pot');
    expect(within(pot).getByText('Rs 120,000')).toBeOnTheScreen();
    expect(within(pot).getByText('Runs for 12 months: January 2030 to December 2030')).toBeOnTheScreen();
  });

  it('validates required fields and ranges', async () => {
    const { user, onSubmit } = await renderForm();
    await user.type(screen.getByLabelText('Number of members'), '1');
    await user.press(screen.getByRole('button', { name: 'Create committee' }));

    expect(await screen.findByText('Give the committee a name.')).toBeOnTheScreen();
    expect(screen.getByText('Enter the monthly amount.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a number between 2 and 50.')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits typed values as numbers', async () => {
    const { user, onSubmit } = await renderForm();
    await user.type(screen.getByLabelText('Committee name'), ' Office Kameti ');
    await user.type(screen.getByLabelText('Monthly amount per member'), '10,000');
    await user.type(screen.getByLabelText('Number of members'), '10');
    await user.press(screen.getByRole('radio', { name: 'Members choose' }));
    await user.press(screen.getByRole('button', { name: 'Create committee' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          name: 'Office Kameti',
          description: '',
          contributionAmount: 10000,
          memberCount: 10,
          startMonth: '2030-01-01',
          dueDay: 5,
          payoutOffsetDays: 5,
          payoutOrderMethod: 'member_choice',
          includeOrganizer: true,
        },
        undefined,
      ),
    );
  });

  it('keeps the payout day within the 28th when the due day moves later', async () => {
    const { user } = await renderForm();
    expect(
      screen.getByRole('button', { name: /Payout day: 5 days after the due date \(day 10\)/ }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: /Payment due day/ }));
    await user.press(screen.getByRole('radio', { name: 'Day 26 of every month' }));

    expect(
      screen.getByRole('button', { name: /Payout day: 2 days after the due date \(day 28\)/ }),
    ).toBeOnTheScreen();
  });

  it('rejects paisa instead of silently changing the amount', async () => {
    const { user, onSubmit } = await renderForm();
    await user.type(screen.getByLabelText('Committee name'), 'X');
    await user.type(screen.getByLabelText('Number of members'), '5');
    await user.type(screen.getByLabelText('Monthly amount per member'), '5000.50');
    expect(screen.getByLabelText('Monthly amount per member')).toHaveDisplayValue('5000.50');
    await user.press(screen.getByRole('button', { name: 'Create committee' }));
    expect(await screen.findByText('Enter whole rupees, without paisa.')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
