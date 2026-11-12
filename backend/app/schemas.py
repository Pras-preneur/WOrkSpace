"""Pydantic v2 request schemas (responses are plain JSON built by the services)."""
from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, StringConstraints, model_validator

Role = Literal["Admin", "Project Manager", "Team Member", "Client"]
ProjectStatus = Literal["Planning", "Active", "On Hold", "Completed", "Cancelled"]
TaskStatus = Literal["To Do", "In Progress", "In Review", "Done", "Blocked"]
Priority = Literal["Low", "Medium", "High", "Urgent"]
ClientStatus = Literal["Lead", "Active", "Inactive"]


def _date(v):
    if v in (None, ""):
        return None
    date.fromisoformat(v)  # raises ValueError -> 422
    return v


# Lightweight e-mail type (no extra dependency). Swap for pydantic.EmailStr if email-validator is installed.
EmailStr = Annotated[str, StringConstraints(strip_whitespace=True, max_length=254,
                                            pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]

DateStr = Annotated[str | None, AfterValidator(_date)]


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RefreshIn(BaseModel):
    refresh_token: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: Role = "Team Member"
    password: str = Field(min_length=8, max_length=128)
    title: str = ""
    primary_responsibility: str = ""
    responsibilities: list[str] = []
    skills: list[str] = []
    phone: str = ""
    bio: str = ""
    avatar_color: str = "#6366f1"


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    role: Role | None = None
    title: str | None = None
    primary_responsibility: str | None = None
    responsibilities: list[str] | None = None
    skills: list[str] | None = None
    phone: str | None = None
    bio: str | None = None
    avatar_color: str | None = None
    active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class ClientIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    company: str = ""
    contact_person: str = ""
    email: str = ""
    phone: str = ""
    notes: str = ""
    status: ClientStatus = "Active"


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    company: str | None = None
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    notes: str | None = None
    status: ClientStatus | None = None


class ProjectIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str = ""
    client_id: int | None = None
    manager_id: int | None = None
    status: ProjectStatus = "Planning"
    priority: Priority = "Medium"
    start_date: DateStr = None
    deadline: DateStr = None
    budget: float | None = Field(default=None, ge=0)
    member_ids: list[int] = []


    @model_validator(mode="after")
    def _order(self):
        if self.start_date and self.deadline and self.deadline < self.start_date:
            raise ValueError("deadline must be on or after start_date")
        return self


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = None
    client_id: int | None = None
    manager_id: int | None = None
    status: ProjectStatus | None = None
    priority: Priority | None = None
    start_date: DateStr = None
    deadline: DateStr = None
    budget: float | None = Field(default=None, ge=0)



class MemberIn(BaseModel):
    user_id: int
    project_role: str = "Contributor"


class MembersPut(BaseModel):
    members: list[MemberIn]


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class TaskIn(BaseModel):
    project_id: int
    title: str = Field(min_length=2, max_length=200)
    description: str = ""
    assignee_id: int | None = None
    status: TaskStatus = "To Do"
    priority: Priority = "Medium"
    due_date: DateStr = None
    estimated_hours: float | None = Field(default=None, ge=0)
    labels: list[str] = []



class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    assignee_id: int | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None
    due_date: DateStr = None
    estimated_hours: float | None = Field(default=None, ge=0)
    labels: list[str] | None = None



class TaskMove(BaseModel):
    status: TaskStatus
    position: int | None = Field(default=None, ge=0)


class SubtaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class SubtaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    done: bool | None = None
