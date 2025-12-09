We have 2 dbs:

1) hawk_events - for storing events
2) hawk - for storing hawk data (accounts, workspaces, projects, etc)


## Hawk Accounts DB

1) users - for storing users

| field | description | example |
|-------|-------------|---------|
| _id | User's id | 5e4f053246587114198eacda |
| email | User's email | "mail@example.com" |
| password | User's password | "$argon2id$v=11$m=4096,t=3,p=1$SKEK3jKkdWOKwPqlEjRc+A$jz07GCY9nVRMMP1wc…" |
| notifications | User's notifications Settings | Object |
| image | User's image | "https://static.hawk.so/4f0120df-15d7-4c0f-9069-f5d67323183b.false" |
| projectsLastVisit | When user last visited project | {67f81efb82a14b26e49dffa7: 1744317119.049} |
| workspaces | User's membership in workspaces | { 5e4ff30a628a6c73a415f4d5: { isPending: false } } |

2) workspaces - for storing workspaces

| field | description | example |
|-------|-------------|---------|
| _id | Workspace's id | 5e4fd1214ee6ce18308361ef |
| name | Workspace's name | "My workspae ekekekke" |
| description | Workspace's description | null |
| image | Workspace's image | null |
| tariffPlanId | Workspace's tariff plan id | 5f47f031ff71510040f433c1 |
| lastChargeDate | Workspace's last charge date | 2025-11-17T23:05:00.111+00:00 |
| billingPeriodEventsCount | Workspace's billing period events count | 123440 |
| inviteHash | Workspace's invite hash | "52a72e2195ab264ae5f7a05c477375d49e73b43bcebdc1f9a0039dca34d92a36" |
| isBlocked | Workspace's is blocked | false |

3) projects - for storing projects

| field | description | example |
|-------|-------------|---------|
| _id | Project's id | 5e4fd1334ee6ce18308361f2 |
| name | Project's name | "Murrr" |
| workspaceId | Project's workspace id | 5e4fd1214ee6ce18308361ef |
| uidAdded | Project's user id | 5e4fd0f74ee6ce18308361ee |
| token | Project's token | "eyJpbnRlZ3JhdGlvbklkIjoiMDAyZGFkZTAtZjU5ZC00NWY5LWE5ZTAtNGIwZTIxZjk3ZD…" |
| archivedEventsCount | Project's archived events count | 7 |
| integrationId | Project's integration id | "002dade0-f59d-45f9-a9e0-4b0e21f97d2d" |
| notifications | Project's notifications | [{_id: ObjectId, isEnabled: boolean, uidAdded: ObjectId, whatToReceive: string, including: string[], excluding: string[], channels: Object, threshold: number, thresholdPeriod: number}] |

3) team:<workspaceId>

| field | description | example |
|-------|-------------|---------|
| _id | Team's id | 5e4ff30a628a6cc93e15f4d6 |
| userId | Team's user id. Null in case when user does not accept invitation | 5e4f053246587414198eabda |
| isAdmin | Team's is admin | true |
| userEmail | When uses does not accept invitation, user email is stored here | "cmtt+sentry@notify.flant.com" |


## Hawk Events DB

1) events:<projectId>

Stores original events from catchers.

| field | description | example |
|-------|-------------|---------|
| _id | Event's id | 6893631a2176d3aa56e46b74 |
| groupHash | Event's group hash | "0b8aa4148b28d8dd6f540fbdfa6d4830ab9c738134f56265157118140e79cad2" |
| totalCount | Event's total count | 26482 |
| catcherType | Event's catcher type | "errors/nodejs" |
| payload | Original event payload | See <a href="https://docs.hawk.so/event-format">Event Payload</a> for more details |
| timestamp | Event's timestamp | 1754489626 |
| usersAffected | Event's users affected | 0 |
| visitedBy | Event's visited by | Array (6) |


2) repetitions:<projectId>

All remaining event repetitions are stored here.

| field | description | example |
|-------|-------------|---------|
| _id | Repetition's id | 690e1e84f47155805f5df476 |
| groupHash | Repetition's group hash | "0b8aa4148b28d8dd6f540fbdfa6d4830ab9c738134f56265157118140e79cad2" |
| delta | Repetition's delta | "{user: 2}" |
| timestamp | Repetition's timestamp | 1762532996 |

3) dailyEvents:<projectId>

Stores daily events grouped by days

| field | description | example |
|-------|-------------|---------|
| _id | Daily event's id | 690e8c97c5dc69fda8ca321a |
| groupHash | Daily event's group hash | "0b8aa4148b28d8dd6f540fbdfa6d4830ab9c738134f56265157118140e79cad2" |
| groupingTimestamp | Particulary day timestamp | 1762560000 |
| affectedUsers | Daily event's affected users | 0 |
| count | Daily event's count | 14 |
| lastRepetitionId | Daily event's last repetition id | 690fac23f6b9df643ecbdf78 |
| lastRepetitionTime | Daily event's last repetition time | 1762634787 |


4) releases

Stores releases. See <a href="https://docs.hawk-tracker.ru/releases">Releases</a> for more details.

| field | description | example |
|-------|-------------|---------|
| _id | Release's id | 68d2fd44bc89c68676bc4ed8 |
| projectId | Release's project id | "67dbc574471d409f3e9ed738" |
| release | Release's release | "v3" |
| files | Release's files | Array (5) |
| commits | Release's commits | Array (empty) |


| workspace id | workspace name | project id | project name | website | segment |
| -- | -- | -- | -- | -- | -- |
| 5e4ff30a628a6c73a415f4d5 | KMTT | 60d05cc11271895fded62138 | dtf.ru production [PHP] | https://vc.ru | ... |
