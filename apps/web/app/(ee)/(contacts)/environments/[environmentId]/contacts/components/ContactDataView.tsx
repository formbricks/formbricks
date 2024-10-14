"use client";

import { debounce } from "lodash";
import { useEffect, useState } from "react";
import React from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { getContactsAction } from "../actions";
import { TContactWithAttributes } from "../types/contact";
import { ContactTable } from "./ContactTable";

interface ContactDataViewProps {
  environment: TEnvironment;
  itemsPerPage: number;
}

export const ContactDataView = ({ environment, itemsPerPage }: ContactDataViewProps) => {
  const [contacts, setContacts] = useState<TContactWithAttributes[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingNextPage, setLoadingNextPage] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoaded(false);
      try {
        setHasMore(true);
        const contactsActionData = await getContactsAction({
          environmentId: environment.id,
          offset: 0,
          searchValue,
        });
        if (contactsActionData?.data) {
          setContacts(contactsActionData.data);
        }
        if (contactsActionData?.data && contactsActionData.data.length < itemsPerPage) {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error fetching people data:", error);
      } finally {
        setIsDataLoaded(true);
      }
    };

    const debouncedFetchData = debounce(fetchData, 300);
    debouncedFetchData();

    return () => {
      debouncedFetchData.cancel();
    };
  }, [searchValue]);

  const fetchNextPage = async () => {
    if (hasMore && !loadingNextPage) {
      setLoadingNextPage(true);
      try {
        const getPersonsActionData = await getContactsAction({
          environmentId: environment.id,
          offset: contacts.length,
          searchValue,
        });
        const personData = getPersonsActionData?.data;
        if (personData) {
          setContacts((prevPersonsData) => [...prevPersonsData, ...personData]);
          if (personData.length === 0 || personData.length < itemsPerPage) {
            setHasMore(false);
          }
        }
      } catch (error) {
        console.error("Error fetching next page of people data:", error);
      } finally {
        setLoadingNextPage(false);
      }
    }
  };

  const deletePersons = (personIds: string[]) => {
    setContacts((prevPersons) => prevPersons.filter((p) => !personIds.includes(p.id)));
  };

  const contactsTableData = contacts.map((person) => ({
    id: person.id,
    userId: person.attributes.userId,
    email: person.attributes.email,
    firstName: person.attributes.firstName,
    lastName: person.attributes.lastName,
    attributes: person.attributes,
  }));

  return (
    <ContactTable
      data={contactsTableData}
      fetchNextPage={fetchNextPage}
      hasMore={hasMore}
      isDataLoaded={isDataLoaded}
      deletePersons={deletePersons}
      environmentId={environment.id}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
    />
  );
};
