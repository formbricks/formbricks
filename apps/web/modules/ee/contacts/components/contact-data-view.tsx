"use client";

import { debounce } from "lodash";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import React from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TEnvironment } from "@formbricks/types/environment";
import { LoadingSpinner } from "@formbricks/ui/components/LoadingSpinner";
import { deleteContactAction, getContactsAction } from "../actions";
import { TContactTableData, TContactWithAttributes } from "../types/contact";
import { ContactsTable } from "./contacts-table";

interface ContactDataViewProps {
  environment: TEnvironment;
  contactAttributeKeys: TContactAttributeKey[];
  initialContacts: TContactWithAttributes[];
  itemsPerPage: number;
  isReadOnly: boolean;
  hasMore: boolean;
}

export const ContactDataView = ({
  environment,
  itemsPerPage,
  contactAttributeKeys,
  initialContacts,
  isReadOnly,
  hasMore: initialHasMore,
}: ContactDataViewProps) => {
  const router = useRouter();
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [contacts, setContacts] = useState<TContactWithAttributes[]>(initialContacts);
  const [isContactsLoaded, setIsContactsLoaded] = useState(true);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loadingNextPage, setLoadingNextPage] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>("");

  const environmentAttributes = useMemo(() => {
    return contactAttributeKeys.filter(
      (attr) => !["userId", "email", "firstName", "lastName"].includes(attr.key)
    );
  }, [contactAttributeKeys]);

  // Fetch contacts
  useEffect(() => {
    // Skip the initial render
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }

    const fetchContacts = async () => {
      setIsContactsLoaded(false);
      try {
        setHasMore(true);
        const contactsResponse = await getContactsAction({
          environmentId: environment.id,
          offset: 0,
          searchValue,
        });
        const contactsData = contactsResponse?.data || [];
        setContacts(contactsData);

        if (contactsData.length < itemsPerPage) {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
        setContacts([]);
        setHasMore(false);
      } finally {
        setIsContactsLoaded(true);
      }
    };

    const debouncedFetchContacts = debounce(fetchContacts, 300);
    debouncedFetchContacts();

    return () => {
      debouncedFetchContacts.cancel();
    };
  }, [searchValue, environment.id, itemsPerPage, isFirstRender]);

  // Fetch next page of contacts
  const fetchNextPage = async () => {
    if (hasMore && !loadingNextPage) {
      setLoadingNextPage(true);
      try {
        const contactsResponse = await getContactsAction({
          environmentId: environment.id,
          offset: contacts.length,
          searchValue,
        });
        const contactsData = contactsResponse?.data || [];

        setContacts((prevContacts) => [...prevContacts, ...contactsData]);

        if (contactsData.length < itemsPerPage) {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error fetching next page of contacts:", error);
      } finally {
        setLoadingNextPage(false);
      }
    }
  };

  // Delete selected contacts
  const deletePersons = async (contactIds: string[]) => {
    await Promise.all(contactIds.map((contactId) => deleteContactAction({ contactId })));
    setContacts((prevContacts) => prevContacts.filter((contact) => !contactIds.includes(contact.id)));

    router.refresh();
  };

  // Prepare data for the ContactTable component
  const contactsTableData: TContactTableData[] = useMemo(() => {
    return contacts.map((person) => ({
      id: person.id,
      userId: person.attributes.userId ?? "",
      email: person.attributes.email ?? "",
      firstName: person.attributes.firstName ?? "",
      lastName: person.attributes.lastName ?? "",
      attributes: (environmentAttributes ?? []).map((attr) => ({
        key: attr.key,
        name: attr.name,
        value: person.attributes[attr.key] ?? "",
      })),
    }));
  }, [contacts, environmentAttributes]);

  // Show a loading indicator until both contacts and attributes are loaded
  if (!isContactsLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <ContactsTable
      data={contactsTableData}
      fetchNextPage={fetchNextPage}
      hasMore={hasMore}
      isDataLoaded={isContactsLoaded}
      deletePersons={deletePersons}
      environmentId={environment.id}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      isReadOnly={isReadOnly}
    />
  );
};
