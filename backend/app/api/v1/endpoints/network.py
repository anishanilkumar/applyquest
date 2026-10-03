from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models import network as network_model
from app.models import user as user_model
from app.schemas import network as network_schema

router = APIRouter()

@router.get("/", response_model=List[network_schema.NetworkContact])
def read_network_contacts(
    skip: int = 0,
    limit: Optional[int] = None,
    db: Session = Depends(deps.get_db),
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve network contacts.
    """
    query = (
        db.query(network_model.NetworkContact)
        .filter(network_model.NetworkContact.user_id == current_user.id)
        .order_by(network_model.NetworkContact.created_at.desc(), network_model.NetworkContact.id)
        .offset(skip)
    )
    if limit is not None:
        query = query.limit(limit)
    contacts = query.all()
    return contacts

@router.post("/", response_model=network_schema.NetworkContact)
def create_network_contact(
    *,
    db: Session = Depends(deps.get_db),
    contact_in: network_schema.NetworkContactCreate,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new network contact.
    """
    contact = network_model.NetworkContact(
        **contact_in.dict(),
        user_id=current_user.id
    )
    db.add(contact)
    db.flush()  # Get the contact ID
    
    # Update gamification stats (1 point for adding contact)
    from app.core import gamification
    gamification.add_points(
        db=db,
        user=current_user,
        points=1,
        reason="Added network contact",
        reference_type="network_contact",
        reference_id=contact.id
    )
    
    db.commit()
    db.refresh(contact)
    return contact

@router.put("/{id}", response_model=network_schema.NetworkContact)
def update_network_contact(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    contact_in: network_schema.NetworkContactUpdate,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Update a network contact.
    """
    contact = db.query(network_model.NetworkContact).filter(
        network_model.NetworkContact.id == id,
        network_model.NetworkContact.user_id == current_user.id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    update_data = contact_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contact, field, value)
    
    db.add(contact)
    
    # Update gamification stats (1 point for update)
    from app.core import gamification
    gamification.add_points(
        db=db,
        user=current_user,
        points=1,
        reason="Updated network contact",
        reference_type="network_contact",
        reference_id=contact.id
    )
    
    db.commit()
    db.refresh(contact)
    return contact

@router.delete("/{id}", response_model=network_schema.NetworkContact)
def delete_network_contact(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a network contact.
    """
    contact = db.query(network_model.NetworkContact).filter(
        network_model.NetworkContact.id == id,
        network_model.NetworkContact.user_id == current_user.id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    db.delete(contact)
    db.commit()
    return contact
